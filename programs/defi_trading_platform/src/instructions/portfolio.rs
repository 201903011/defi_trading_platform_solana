use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::events::*;

pub fn create_portfolio(ctx: Context<CreatePortfolio>) -> Result<()> {
    let portfolio = &mut ctx.accounts.portfolio;
    
    portfolio.user = ctx.accounts.user.key();
    portfolio.total_holdings = 0;
    portfolio.total_value = 0;
    portfolio.total_invested = 0;
    portfolio.total_profit_loss = 0;
    portfolio.holdings_count = 0;
    portfolio.last_updated = Clock::get()?.unix_timestamp;
    portfolio.bump = ctx.bumps.portfolio;

    emit!(PortfolioCreated {
        user: portfolio.user,
        timestamp: portfolio.last_updated,
    });

    Ok(())
}

pub fn update_portfolio(ctx: Context<UpdatePortfolio>) -> Result<()> {
    let portfolio = &mut ctx.accounts.portfolio;
    
    // This function would typically be called after trades or price updates
    // to recalculate portfolio values
    
    // Calculate total value from all holdings
    let mut total_value = 0u64;
    let mut total_invested = 0u64;
    let mut holdings_count = 0u64;
    
    // In a real implementation, we would iterate through all user holdings
    // For now, we'll update based on the provided holding
    if let Some(holding_account) = ctx.accounts.holding.as_ref() {
        let holding = &holding_account;
        total_value = total_value
            .checked_add(holding.current_value)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        total_invested = total_invested
            .checked_add(holding.total_invested)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        holdings_count = holdings_count
            .checked_add(1)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
    }
    
    portfolio.total_value = total_value;
    portfolio.total_invested = total_invested;
    portfolio.total_profit_loss = (total_value as i64)
        .checked_sub(total_invested as i64)
        .ok_or(DefiTradingError::ArithmeticUnderflow)?;
    portfolio.holdings_count = holdings_count;
    portfolio.last_updated = Clock::get()?.unix_timestamp;

    emit!(PortfolioUpdated {
        user: portfolio.user,
        total_holdings: portfolio.total_holdings,
        total_value: portfolio.total_value,
        total_invested: portfolio.total_invested,
        total_profit_loss: portfolio.total_profit_loss,
        timestamp: portfolio.last_updated,
    });

    Ok(())
}

pub fn update_holding_after_trade(
    ctx: Context<UpdateHolding>,
    company_id: u64,
    amount_change: i64, // positive for buy, negative for sell
    price: u64,
    is_buy: bool,
) -> Result<()> {
    let holding = &mut ctx.accounts.holding;
    let portfolio = &mut ctx.accounts.portfolio;
    
    let current_timestamp = Clock::get()?.unix_timestamp;
    
    if is_buy {
        // Buying tokens
        let amount_bought = amount_change as u64;
        let cost = amount_bought
            .checked_mul(price)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        
        let new_total_invested = holding.total_invested
            .checked_add(cost)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        
        let new_amount = holding.amount
            .checked_add(amount_bought)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        
        // Calculate new average price
        let new_average_price = if new_amount > 0 {
            new_total_invested
                .checked_div(new_amount)
                .ok_or(DefiTradingError::DivisionByZero)?
        } else {
            0
        };
        
        holding.amount = new_amount;
        holding.average_price = new_average_price;
        holding.total_invested = new_total_invested;
        holding.current_value = new_amount
            .checked_mul(price)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        holding.profit_loss = (holding.current_value as i64)
            .checked_sub(holding.total_invested as i64)
            .ok_or(DefiTradingError::ArithmeticUnderflow)?;
    } else {
        // Selling tokens
        let amount_sold = (-amount_change) as u64;
        
        require!(holding.amount >= amount_sold, DefiTradingError::InsufficientTokens);
        
        // Calculate cost basis of sold tokens
        let cost_basis_sold = amount_sold
            .checked_mul(holding.average_price)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        
        holding.amount = holding.amount
            .checked_sub(amount_sold)
            .ok_or(DefiTradingError::ArithmeticUnderflow)?;
        holding.total_invested = holding.total_invested
            .checked_sub(cost_basis_sold)
            .ok_or(DefiTradingError::ArithmeticUnderflow)?;
        holding.current_value = holding.amount
            .checked_mul(price)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        holding.profit_loss = (holding.current_value as i64)
            .checked_sub(holding.total_invested as i64)
            .ok_or(DefiTradingError::ArithmeticUnderflow)?;
    }
    
    holding.last_updated = current_timestamp;
    
    // Update portfolio totals
    portfolio.last_updated = current_timestamp;

    emit!(HoldingUpdated {
        user: holding.user,
        company_id: holding.company_id,
        token_mint: holding.token_mint,
        amount: holding.amount,
        average_price: holding.average_price,
        total_invested: holding.total_invested,
        current_value: holding.current_value,
        profit_loss: holding.profit_loss,
        timestamp: current_timestamp,
    });

    Ok(())
}

pub fn create_or_update_holding(
    ctx: Context<CreateOrUpdateHolding>,
    company_id: u64,
    amount: u64,
    price: u64,
) -> Result<()> {
    let holding = &mut ctx.accounts.holding;
    let portfolio = &mut ctx.accounts.portfolio;
    
    let current_timestamp = Clock::get()?.unix_timestamp;
    let cost = amount
        .checked_mul(price)
        .ok_or(DefiTradingError::ArithmeticOverflow)?;
    
    // Initialize or update holding
    if holding.amount == 0 {
        // New holding
        holding.user = ctx.accounts.user.key();
        holding.company_id = company_id;
        holding.token_mint = ctx.accounts.company.token_mint;
        holding.amount = amount;
        holding.average_price = price;
        holding.total_invested = cost;
        holding.current_value = cost;
        holding.profit_loss = 0;
        holding.last_updated = current_timestamp;
        holding.bump = ctx.bumps.holding;
        
        // Update portfolio holdings count
        portfolio.holdings_count = portfolio.holdings_count
            .checked_add(1)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
    } else {
        // Update existing holding
        let new_total_invested = holding.total_invested
            .checked_add(cost)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        
        let new_amount = holding.amount
            .checked_add(amount)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        
        let new_average_price = new_total_invested
            .checked_div(new_amount)
            .ok_or(DefiTradingError::DivisionByZero)?;
        
        holding.amount = new_amount;
        holding.average_price = new_average_price;
        holding.total_invested = new_total_invested;
        holding.current_value = new_amount
            .checked_mul(price)
            .ok_or(DefiTradingError::ArithmeticOverflow)?;
        holding.profit_loss = (holding.current_value as i64)
            .checked_sub(holding.total_invested as i64)
            .ok_or(DefiTradingError::ArithmeticUnderflow)?;
        holding.last_updated = current_timestamp;
    }
    
    portfolio.last_updated = current_timestamp;

    emit!(HoldingUpdated {
        user: holding.user,
        company_id: holding.company_id,
        token_mint: holding.token_mint,
        amount: holding.amount,
        average_price: holding.average_price,
        total_invested: holding.total_invested,
        current_value: holding.current_value,
        profit_loss: holding.profit_loss,
        timestamp: current_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreatePortfolio<'info> {
    #[account(
        init,
        payer = user,
        space = Portfolio::LEN,
        seeds = [b"portfolio", user.key().as_ref()],
        bump
    )]
    pub portfolio: Account<'info, Portfolio>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePortfolio<'info> {
    #[account(
        mut,
        seeds = [b"portfolio", portfolio.user.as_ref()],
        bump = portfolio.bump
    )]
    pub portfolio: Account<'info, Portfolio>,
    
    #[account(
        seeds = [
            b"holding",
            portfolio.user.as_ref(),
            holding.company_id.to_le_bytes().as_ref()
        ],
        bump = holding.bump
    )]
    pub holding: Option<Account<'info, Holding>>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateHolding<'info> {
    #[account(
        mut,
        seeds = [
            b"holding",
            holding.user.as_ref(),
            holding.company_id.to_le_bytes().as_ref()
        ],
        bump = holding.bump
    )]
    pub holding: Account<'info, Holding>,
    
    #[account(
        mut,
        seeds = [b"portfolio", portfolio.user.as_ref()],
        bump = portfolio.bump
    )]
    pub portfolio: Account<'info, Portfolio>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(company_id: u64)]
pub struct CreateOrUpdateHolding<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = Holding::LEN,
        seeds = [
            b"holding",
            user.key().as_ref(),
            company_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub holding: Account<'info, Holding>,
    
    #[account(
        mut,
        seeds = [b"portfolio", user.key().as_ref()],
        bump = portfolio.bump
    )]
    pub portfolio: Account<'info, Portfolio>,
    
    #[account(
        seeds = [b"company", company_id.to_le_bytes().as_ref()],
        bump = company.bump
    )]
    pub company: Account<'info, Company>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}