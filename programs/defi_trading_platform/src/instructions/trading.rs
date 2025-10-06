use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

pub fn create_sell_order(
    ctx: Context<CreateSellOrder>,
    amount: u64,
    price: u64,
) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    let order = &mut ctx.accounts.order;
    
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(amount > 0, DefiTradingError::InvalidOrderParams);
    require!(price > 0, DefiTradingError::InvalidOrderParams);
    
    // Check if user has enough tokens
    require!(
        ctx.accounts.user_token_account.amount >= amount,
        DefiTradingError::InsufficientTokens
    );

    let order_id = platform.total_trades + 1; // Using total_trades as order counter
    
    order.id = order_id;
    order.user = ctx.accounts.user.key();
    order.company_id = ctx.accounts.company.id;
    order.token_mint = ctx.accounts.company.token_mint;
    order.order_type = OrderType::Sell;
    order.amount = amount;
    order.remaining_amount = amount;
    order.price = price;
    order.status = OrderStatus::Active;
    order.created_at = Clock::get()?.unix_timestamp;
    order.filled_at = None;
    order.bump = ctx.bumps.order;

    // Escrow tokens from user
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.order_escrow_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::transfer(cpi_ctx, amount)?;

    emit!(OrderCreated {
        order_id,
        user: order.user,
        company_id: order.company_id,
        token_mint: order.token_mint,
        order_type: "Sell".to_string(),
        amount,
        price,
        timestamp: order.created_at,
    });

    Ok(())
}

pub fn create_buy_order(
    ctx: Context<CreateBuyOrder>,
    amount: u64,
    price: u64,
) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    let order = &mut ctx.accounts.order;
    
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(amount > 0, DefiTradingError::InvalidOrderParams);
    require!(price > 0, DefiTradingError::InvalidOrderParams);
    
    let total_cost = amount
        .checked_mul(price)
        .ok_or(DefiTradingError::ArithmeticOverflow)?;
    
    // Check if user has enough payment tokens
    require!(
        ctx.accounts.user_payment_account.amount >= total_cost,
        DefiTradingError::InsufficientFunds
    );

    let order_id = platform.total_trades + 1;
    
    order.id = order_id;
    order.user = ctx.accounts.user.key();
    order.company_id = ctx.accounts.company.id;
    order.token_mint = ctx.accounts.company.token_mint;
    order.order_type = OrderType::Buy;
    order.amount = amount;
    order.remaining_amount = amount;
    order.price = price;
    order.status = OrderStatus::Active;
    order.created_at = Clock::get()?.unix_timestamp;
    order.filled_at = None;
    order.bump = ctx.bumps.order;

    // Escrow payment from user
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_payment_account.to_account_info(),
        to: ctx.accounts.order_escrow_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::transfer(cpi_ctx, total_cost)?;

    emit!(OrderCreated {
        order_id,
        user: order.user,
        company_id: order.company_id,
        token_mint: order.token_mint,
        order_type: "Buy".to_string(),
        amount,
        price,
        timestamp: order.created_at,
    });

    Ok(())
}

pub fn execute_trade(
    ctx: Context<ExecuteTrade>,
    sell_order_id: u64,
    buy_order_id: u64,
    amount: u64,
) -> Result<()> {
    // Store account info before any mutations
    let sell_order_info = ctx.accounts.sell_order.to_account_info();
    let buy_order_info = ctx.accounts.buy_order.to_account_info();

    let platform = &mut ctx.accounts.platform;
    let sell_order = &mut ctx.accounts.sell_order;
    let buy_order = &mut ctx.accounts.buy_order;
    let trade = &mut ctx.accounts.trade;
    
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(amount > 0, DefiTradingError::InvalidTradeAmount);
    require!(sell_order.id == sell_order_id, DefiTradingError::OrderNotFound);
    require!(buy_order.id == buy_order_id, DefiTradingError::OrderNotFound);
    require!(sell_order.status == OrderStatus::Active, DefiTradingError::OrderAlreadyFilled);
    require!(buy_order.status == OrderStatus::Active, DefiTradingError::OrderAlreadyFilled);
    require!(sell_order.user != buy_order.user, DefiTradingError::SelfTrade);
    require!(sell_order.price <= buy_order.price, DefiTradingError::PriceMismatch);
    require!(amount <= sell_order.remaining_amount, DefiTradingError::InvalidTradeAmount);
    require!(amount <= buy_order.remaining_amount, DefiTradingError::InvalidTradeAmount);

    let trade_price = sell_order.price; // Use sell order price
    let total_value = amount
        .checked_mul(trade_price)
        .ok_or(DefiTradingError::ArithmeticOverflow)?;
    
    let platform_fee = total_value
        .checked_mul(platform.platform_fee as u64)
        .ok_or(DefiTradingError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(DefiTradingError::DivisionByZero)?;
    
    let seller_proceeds = total_value
        .checked_sub(platform_fee)
        .ok_or(DefiTradingError::ArithmeticUnderflow)?;

    let trade_id = platform.total_trades + 1;
    // Store values before borrowing
    let sell_order_id = sell_order.id;
    let sell_order_user = sell_order.user;
    let sell_order_bump = sell_order.bump;
    
    // Record trade
    trade.id = trade_id;
    trade.buyer = buy_order.user;
    trade.seller = sell_order.user;
    trade.company_id = sell_order.company_id;
    trade.token_mint = sell_order.token_mint;
    trade.amount = amount;
    trade.price = trade_price;
    trade.total_value = total_value;
    trade.platform_fee = platform_fee;
    trade.buy_order_id = buy_order_id;
    trade.sell_order_id = sell_order_id;
    trade.executed_at = Clock::get()?.unix_timestamp;
    trade.bump = ctx.bumps.trade;

    // Transfer tokens from sell order escrow to buyer
    let sell_order_id_bytes = sell_order_id.to_le_bytes();
    let sell_seeds = &[
        b"order",
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

    // Transfer payment from buy order escrow to seller
    let buy_order_id = buy_order.id;
    let buy_order_user = buy_order.user;
    let buy_order_bump = buy_order.bump;
    
    let buy_order_id_bytes = buy_order_id.to_le_bytes();
    let buy_seeds = &[
        b"order",
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

    // Transfer platform fee
    let cpi_accounts = Transfer {
        from: ctx.accounts.buy_order_escrow.to_account_info(),
        to: ctx.accounts.platform_fee_account.to_account_info(),
        authority: buy_order_info,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, buy_signer);
    
    token::transfer(cpi_ctx, platform_fee)?;

    // Update orders
    sell_order.remaining_amount = sell_order.remaining_amount
        .checked_sub(amount)
        .ok_or(DefiTradingError::ArithmeticUnderflow)?;
    
    buy_order.remaining_amount = buy_order.remaining_amount
        .checked_sub(amount)
        .ok_or(DefiTradingError::ArithmeticUnderflow)?;

    if sell_order.remaining_amount == 0 {
        sell_order.status = OrderStatus::Filled;
        sell_order.filled_at = Some(Clock::get()?.unix_timestamp);
    } else {
        sell_order.status = OrderStatus::PartiallyFilled;
    }

    if buy_order.remaining_amount == 0 {
        buy_order.status = OrderStatus::Filled;
        buy_order.filled_at = Some(Clock::get()?.unix_timestamp);
    } else {
        buy_order.status = OrderStatus::PartiallyFilled;
    }

    platform.total_trades = trade_id;

    emit!(TradeExecuted {
        trade_id,
        buyer: trade.buyer,
        seller: trade.seller,
        company_id: trade.company_id,
        token_mint: trade.token_mint,
        amount,
        price: trade_price,
        total_value,
        platform_fee,
        buy_order_id,
        sell_order_id,
        timestamp: trade.executed_at,
    });

    Ok(())
}

pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
    // Store account info before any mutations
    let order_info = ctx.accounts.order.to_account_info();

    let order = &mut ctx.accounts.order;
    
    require!(order.status == OrderStatus::Active || order.status == OrderStatus::PartiallyFilled, 
             DefiTradingError::OrderAlreadyCancelled);
    require!(order.user == ctx.accounts.user.key(), DefiTradingError::Unauthorized);

    // Store values before borrowing
    let order_id = order.id;
    let order_user = order.user;
    let order_bump = order.bump;

    // Return escrowed assets to user
    let order_id_bytes = order_id.to_le_bytes();
    let seeds = &[
        b"order",
        order_user.as_ref(),
        order_id_bytes.as_ref(),
        &[order_bump],
    ];
    let signer = &[&seeds[..]];
    
    let remaining_balance = ctx.accounts.order_escrow_account.amount;
    
    if remaining_balance > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.order_escrow_account.to_account_info(),
            to: ctx.accounts.user_account.to_account_info(),
            authority: order_info,
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        
        token::transfer(cpi_ctx, remaining_balance)?;
    }

    order.status = OrderStatus::Cancelled;

    emit!(OrderCancelled {
        order_id: order.id,
        user: order.user,
        company_id: order.company_id,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateSellOrder<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        seeds = [b"company", company.id.to_le_bytes().as_ref()],
        bump = company.bump
    )]
    pub company: Account<'info, Company>,
    
    #[account(
        init,
        payer = user,
        space = Order::LEN,
        seeds = [
            b"order",
            user.key().as_ref(),
            (platform.total_trades + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub order: Account<'info, Order>,
    
    #[account(
        init,
        payer = user,
        token::mint = token_mint,
        token::authority = order,
        seeds = [
            b"order_escrow",
            user.key().as_ref(),
            (platform.total_trades + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub order_escrow_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.mint == company.token_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, anchor_spl::token::Mint>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateBuyOrder<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        seeds = [b"company", company.id.to_le_bytes().as_ref()],
        bump = company.bump
    )]
    pub company: Account<'info, Company>,
    
    #[account(
        init,
        payer = user,
        space = Order::LEN,
        seeds = [
            b"order",
            user.key().as_ref(),
            (platform.total_trades + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub order: Account<'info, Order>,
    
    #[account(
        init,
        payer = user,
        token::mint = payment_mint,
        token::authority = order,
        seeds = [
            b"order_escrow",
            user.key().as_ref(),
            (platform.total_trades + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub order_escrow_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_payment_account: Account<'info, TokenAccount>,
    
    pub payment_mint: Account<'info, anchor_spl::token::Mint>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ExecuteTrade<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        mut,
        seeds = [
            b"order",
            sell_order.user.as_ref(),
            sell_order.id.to_le_bytes().as_ref()
        ],
        bump = sell_order.bump
    )]
    pub sell_order: Account<'info, Order>,
    
    #[account(
        mut,
        seeds = [
            b"order",
            buy_order.user.as_ref(),
            buy_order.id.to_le_bytes().as_ref()
        ],
        bump = buy_order.bump
    )]
    pub buy_order: Account<'info, Order>,
    
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
    
    #[account(
        mut,
        seeds = [
            b"order_escrow",
            sell_order.user.as_ref(),
            sell_order.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub sell_order_escrow: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [
            b"order_escrow",
            buy_order.user.as_ref(),
            buy_order.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub buy_order_escrow: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub seller_payment_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub platform_fee_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(
        mut,
        seeds = [
            b"order",
            order.user.as_ref(),
            order.id.to_le_bytes().as_ref()
        ],
        bump = order.bump
    )]
    pub order: Account<'info, Order>,
    
    #[account(
        mut,
        seeds = [
            b"order_escrow",
            order.user.as_ref(),
            order.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub order_escrow_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}