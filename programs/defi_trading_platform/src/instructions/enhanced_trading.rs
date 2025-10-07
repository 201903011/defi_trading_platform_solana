use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

// Enhanced limit order creation
pub fn create_limit_order(
    ctx: Context<CreateLimitOrder>,
    order_type: OrderType,
    amount: u64,
    price: u64,
) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let orderbook = &mut ctx.accounts.orderbook;
    let order = &mut ctx.accounts.order;
    
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(amount > 0, DefiTradingError::InvalidOrderParams);
    require!(price > 0, DefiTradingError::InvalidOrderParams);

    let order_id = orderbook.total_buy_orders + orderbook.total_sell_orders + 1;
    
    // Validate sufficient balance based on order type
    match order_type {
        OrderType::Sell => {
            require!(
                ctx.accounts.user_token_account.amount >= amount,
                DefiTradingError::InsufficientTokens
            );
            
            // Escrow tokens
            let cpi_accounts = Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.order_escrow_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, amount)?;
            
            orderbook.total_sell_orders = orderbook.total_sell_orders.checked_add(1).unwrap();
            
            // Update best ask if this is a new lowest price
            if orderbook.best_ask == 0 || price < orderbook.best_ask {
                orderbook.best_ask = price;
            }
        },
        OrderType::Buy => {
            let total_cost = amount.checked_mul(price).ok_or(DefiTradingError::ArithmeticOverflow)?;
            require!(
                ctx.accounts.user_payment_account.amount >= total_cost,
                DefiTradingError::InsufficientFunds
            );
            
            // Escrow payment
            let cpi_accounts = Transfer {
                from: ctx.accounts.user_payment_account.to_account_info(),
                to: ctx.accounts.order_escrow_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, total_cost)?;
            
            orderbook.total_buy_orders = orderbook.total_buy_orders.checked_add(1).unwrap();
            
            // Update best bid if this is a new highest price
            if orderbook.best_bid == 0 || price > orderbook.best_bid {
                orderbook.best_bid = price;
            }
        }
    }
    
    // Set up order
    order.id = order_id;
    order.user = ctx.accounts.user.key();
    order.company_id = orderbook.company_id;
    order.token_mint = orderbook.token_mint;
    order.order_type = order_type.clone();
    order.market_order_type = MarketOrderType::Limit;
    order.amount = amount;
    order.remaining_amount = amount;
    order.price = price;
    order.status = OrderStatus::Active;
    order.created_at = Clock::get()?.unix_timestamp;
    order.filled_at = None;
    order.bump = ctx.bumps.order;

    orderbook.last_updated = Clock::get()?.unix_timestamp;

    emit!(LimitOrderCreated {
        order_id,
        user: order.user,
        company_id: order.company_id,
        order_type: match order_type {
            OrderType::Buy => "Buy".to_string(),
            OrderType::Sell => "Sell".to_string(),
        },
        amount,
        price,
        timestamp: order.created_at,
    });

    Ok(())
}

// Market order that executes immediately at best available price
pub fn create_market_order(
    ctx: Context<CreateMarketOrder>,
    order_type: OrderType,
    amount: u64,
) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let orderbook = &mut ctx.accounts.orderbook;
    let order = &mut ctx.accounts.order;
    
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(amount > 0, DefiTradingError::InvalidOrderParams);

    let order_id = orderbook.total_buy_orders + orderbook.total_sell_orders + 1;
    let execution_price = match order_type {
        OrderType::Buy => {
            require!(orderbook.best_ask > 0, DefiTradingError::NoLiquidity);
            orderbook.best_ask
        },
        OrderType::Sell => {
            require!(orderbook.best_bid > 0, DefiTradingError::NoLiquidity);
            orderbook.best_bid
        }
    };

    // Validate sufficient balance
    match order_type {
        OrderType::Sell => {
            require!(
                ctx.accounts.user_token_account.amount >= amount,
                DefiTradingError::InsufficientTokens
            );
        },
        OrderType::Buy => {
            let total_cost = amount.checked_mul(execution_price).ok_or(DefiTradingError::ArithmeticOverflow)?;
            require!(
                ctx.accounts.user_payment_account.amount >= total_cost,
                DefiTradingError::InsufficientFunds
            );
        }
    }
    
    // Set up market order (will be immediately filled by matching logic)
    order.id = order_id;
    order.user = ctx.accounts.user.key();
    order.company_id = orderbook.company_id;
    order.token_mint = orderbook.token_mint;
    order.order_type = order_type.clone();
    order.market_order_type = MarketOrderType::Market;
    order.amount = amount;
    order.remaining_amount = amount;
    order.price = execution_price; // Market price
    order.status = OrderStatus::Active;
    order.created_at = Clock::get()?.unix_timestamp;
    order.filled_at = None;
    order.bump = ctx.bumps.order;

    orderbook.last_updated = Clock::get()?.unix_timestamp;

    emit!(MarketOrderCreated {
        order_id,
        user: order.user,
        company_id: order.company_id,
        order_type: match order_type {
            OrderType::Buy => "Buy".to_string(),
            OrderType::Sell => "Sell".to_string(),
        },
        amount,
        execution_price,
        timestamp: order.created_at,
    });

    Ok(())
}

// Enhanced order matching with automatic execution
pub fn match_orders(
    ctx: Context<MatchOrders>,
    buy_order_id: u64,
    sell_order_id: u64,
    amount: u64,
) -> Result<()> {
    // Store account infos before borrowing mutably
    let buy_order_info = ctx.accounts.buy_order.to_account_info();
    let sell_order_info = ctx.accounts.sell_order.to_account_info();
    
    let platform = &mut ctx.accounts.platform;
    let orderbook = &mut ctx.accounts.orderbook;
    let buy_order = &mut ctx.accounts.buy_order;
    let sell_order = &mut ctx.accounts.sell_order;
    let trade = &mut ctx.accounts.trade;
    
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(amount > 0, DefiTradingError::InvalidTradeAmount);
    require!(buy_order.id == buy_order_id, DefiTradingError::OrderNotFound);
    require!(sell_order.id == sell_order_id, DefiTradingError::OrderNotFound);
    require!(buy_order.status == OrderStatus::Active, DefiTradingError::OrderAlreadyFilled);
    require!(sell_order.status == OrderStatus::Active, DefiTradingError::OrderAlreadyFilled);
    require!(buy_order.user != sell_order.user, DefiTradingError::SelfTrade);
    require!(amount <= buy_order.remaining_amount, DefiTradingError::InvalidTradeAmount);
    require!(amount <= sell_order.remaining_amount, DefiTradingError::InvalidTradeAmount);

    // Determine execution price based on order types
    let execution_price = match (buy_order.market_order_type.clone(), sell_order.market_order_type.clone()) {
        (MarketOrderType::Market, MarketOrderType::Limit) => sell_order.price,
        (MarketOrderType::Limit, MarketOrderType::Market) => buy_order.price,
        (MarketOrderType::Market, MarketOrderType::Market) => orderbook.last_trade_price,
        (MarketOrderType::Limit, MarketOrderType::Limit) => {
            require!(buy_order.price >= sell_order.price, DefiTradingError::PriceMismatch);
            sell_order.price // Use seller's price for limit-limit matching
        }
    };

    let total_value = amount.checked_mul(execution_price).ok_or(DefiTradingError::ArithmeticOverflow)?;
    let platform_fee = total_value
        .checked_mul(platform.platform_fee as u64)
        .ok_or(DefiTradingError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(DefiTradingError::DivisionByZero)?;
    let seller_proceeds = total_value.checked_sub(platform_fee).ok_or(DefiTradingError::ArithmeticUnderflow)?;

    let trade_id = platform.total_trades + 1;
    
    // Record trade
    trade.id = trade_id;
    trade.buyer = buy_order.user;
    trade.seller = sell_order.user;
    trade.company_id = orderbook.company_id;
    trade.token_mint = orderbook.token_mint;
    trade.amount = amount;
    trade.price = execution_price;
    trade.total_value = total_value;
    trade.platform_fee = platform_fee;
    trade.buy_order_id = buy_order_id;
    trade.sell_order_id = sell_order_id;
    trade.executed_at = Clock::get()?.unix_timestamp;
    trade.bump = ctx.bumps.trade;

    // Execute transfers based on order type
    let buy_order_user = buy_order.user;
    let buy_order_bump = buy_order.bump;
    let sell_order_user = sell_order.user;
    let sell_order_bump = sell_order.bump;
    
    if buy_order.market_order_type == MarketOrderType::Market {
        // Market buy order - transfer payment directly from user
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_payment_account.to_account_info(),
            to: ctx.accounts.seller_payment_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, seller_proceeds)?;

        // Platform fee
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_payment_account.to_account_info(),
            to: ctx.accounts.platform_fee_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, platform_fee)?;
    } else {
        // Limit buy order - transfer from escrow
        let buy_order_id_bytes = buy_order_id.to_le_bytes();
        
        let buy_seeds = &[
            b"enhanced_order",
            buy_order_user.as_ref(),
            buy_order_id_bytes.as_ref(),
            &[buy_order_bump],
        ];
        let buy_signer = &[&buy_seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.buy_order_escrow.to_account_info(),
            to: ctx.accounts.seller_payment_account.to_account_info(),
            authority: buy_order_info.clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, buy_signer);
        token::transfer(cpi_ctx, seller_proceeds)?;

        // Platform fee
        let cpi_accounts = Transfer {
            from: ctx.accounts.buy_order_escrow.to_account_info(),
            to: ctx.accounts.platform_fee_account.to_account_info(),
            authority: buy_order_info.clone(),
        };
        let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, buy_signer);
        token::transfer(cpi_ctx, platform_fee)?;
    }

    // Transfer tokens to buyer
    if sell_order.market_order_type == MarketOrderType::Market {
        // Market sell order - transfer directly from user
        let cpi_accounts = Transfer {
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
    } else {
        // Limit sell order - transfer from escrow
        let sell_order_id_bytes = sell_order_id.to_le_bytes();
        
        let sell_seeds = &[
            b"enhanced_order",
            sell_order_user.as_ref(),
            sell_order_id_bytes.as_ref(),
            &[sell_order_bump],
        ];
        let sell_signer = &[&sell_seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.sell_order_escrow.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: sell_order_info,
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, sell_signer);
        token::transfer(cpi_ctx, amount)?;
    }

    // Update orders
    buy_order.remaining_amount = buy_order.remaining_amount.checked_sub(amount).unwrap();
    sell_order.remaining_amount = sell_order.remaining_amount.checked_sub(amount).unwrap();

    if buy_order.remaining_amount == 0 {
        buy_order.status = OrderStatus::Filled;
        buy_order.filled_at = Some(Clock::get()?.unix_timestamp);
    } else {
        buy_order.status = OrderStatus::PartiallyFilled;
    }

    if sell_order.remaining_amount == 0 {
        sell_order.status = OrderStatus::Filled;
        sell_order.filled_at = Some(Clock::get()?.unix_timestamp);
    } else {
        sell_order.status = OrderStatus::PartiallyFilled;
    }

    // Update orderbook
    orderbook.last_trade_price = execution_price;
    orderbook.total_volume = orderbook.total_volume.checked_add(amount).unwrap();
    orderbook.last_updated = Clock::get()?.unix_timestamp;
    platform.total_trades = trade_id;

    emit!(OrdersMatched {
        trade_id,
        buyer: buy_order.user,
        seller: sell_order.user,
        company_id: orderbook.company_id,
        amount,
        price: execution_price,
        total_value,
        platform_fee,
        buy_order_id,
        sell_order_id,
        timestamp: trade.executed_at,
    });

    Ok(())
}

// Calculate and update market depth
pub fn calculate_market_depth(
    ctx: Context<CalculateMarketDepth>,
    company_id: u64,
) -> Result<()> {
    let orderbook = &ctx.accounts.orderbook;
    let market_depth = &mut ctx.accounts.market_depth;
    
    require!(orderbook.company_id == company_id, DefiTradingError::InvalidCompanyData);

    // Initialize market depth
    market_depth.orderbook = orderbook.key();
    market_depth.price_levels = Vec::new();
    market_depth.total_buy_volume = 0;
    market_depth.total_sell_volume = 0;
    market_depth.last_updated = Clock::get()?.unix_timestamp;
    market_depth.bump = ctx.bumps.market_depth;

    emit!(MarketDepthCalculated {
        company_id,
        orderbook: orderbook.key(),
        total_buy_volume: market_depth.total_buy_volume,
        total_sell_volume: market_depth.total_sell_volume,
        timestamp: market_depth.last_updated,
    });

    Ok(())
}

// Context structs
#[derive(Accounts)]
#[instruction(order_type: OrderType)]
pub struct CreateLimitOrder<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.company_id.to_le_bytes().as_ref()],
        bump = orderbook.bump
    )]
    pub orderbook: Account<'info, Orderbook>,
    
    #[account(
        init,
        payer = user,
        space = EnhancedOrder::LEN,
        seeds = [
            b"enhanced_order",
            user.key().as_ref(),
            (orderbook.total_buy_orders + orderbook.total_sell_orders + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub order: Account<'info, EnhancedOrder>,
    
    #[account(
        init,
        payer = user,
        token::mint = token_mint,
        token::authority = order,
        seeds = [
            b"enhanced_order_escrow",
            user.key().as_ref(),
            (orderbook.total_buy_orders + orderbook.total_sell_orders + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub order_escrow_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.mint == orderbook.token_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_payment_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, anchor_spl::token::Mint>,
    pub payment_mint: Account<'info, anchor_spl::token::Mint>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(order_type: OrderType)]
pub struct CreateMarketOrder<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.company_id.to_le_bytes().as_ref()],
        bump = orderbook.bump
    )]
    pub orderbook: Account<'info, Orderbook>,
    
    #[account(
        init,
        payer = user,
        space = EnhancedOrder::LEN,
        seeds = [
            b"enhanced_order",
            user.key().as_ref(),
            (orderbook.total_buy_orders + orderbook.total_sell_orders + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub order: Account<'info, EnhancedOrder>,
    
    #[account(
        mut,
        constraint = user_token_account.mint == orderbook.token_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_payment_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MatchOrders<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.company_id.to_le_bytes().as_ref()],
        bump = orderbook.bump
    )]
    pub orderbook: Account<'info, Orderbook>,
    
    #[account(
        mut,
        seeds = [
            b"enhanced_order",
            buy_order.user.as_ref(),
            buy_order.id.to_le_bytes().as_ref()
        ],
        bump = buy_order.bump
    )]
    pub buy_order: Account<'info, EnhancedOrder>,
    
    #[account(
        mut,
        seeds = [
            b"enhanced_order",
            sell_order.user.as_ref(),
            sell_order.id.to_le_bytes().as_ref()
        ],
        bump = sell_order.bump
    )]
    pub sell_order: Account<'info, EnhancedOrder>,
    
    #[account(
        init,
        payer = authority,
        space = Trade::LEN,
        seeds = [
            b"trade",
            (platform.total_trades + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub trade: Account<'info, Trade>,
    
    #[account(mut)]
    pub buy_order_escrow: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub sell_order_escrow: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub buyer_payment_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub seller_payment_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub platform_fee_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CalculateMarketDepth<'info> {
    #[account(
        seeds = [b"orderbook", orderbook.company_id.to_le_bytes().as_ref()],
        bump = orderbook.bump
    )]
    pub orderbook: Account<'info, Orderbook>,
    
    #[account(
        init,
        payer = user,
        space = MarketDepth::LEN,
        seeds = [
            b"market_depth",
            orderbook.company_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub market_depth: Account<'info, MarketDepth>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}