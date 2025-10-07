use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Mint, MintTo, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

pub fn register_company(
    ctx: Context<RegisterCompany>,
    name: String,
    symbol: String,
    description: String,
) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    let company = &mut ctx.accounts.company;
    
    // Validate input
    require!(!name.is_empty(), DefiTradingError::InvalidCompanyData);
    require!(name.len() <= 64, DefiTradingError::InvalidCompanyData);
    require!(!symbol.is_empty(), DefiTradingError::InvalidCompanyData);
    require!(symbol.len() <= 16, DefiTradingError::InvalidCompanyData);
    require!(description.len() <= 256, DefiTradingError::InvalidCompanyData);
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);

    let company_id = platform.total_companies + 1;
    
    company.id = company_id;
    company.authority = ctx.accounts.authority.key();
    company.name = name.clone();
    company.symbol = symbol.clone();
    company.description = description;
    company.verified = false;
    company.token_mint = ctx.accounts.token_mint.key();
    company.total_supply = 0;
    company.circulating_supply = 0;
    company.market_cap = 0;
    company.created_at = Clock::get()?.unix_timestamp;
    company.bump = ctx.bumps.company;

    platform.total_companies = company_id;

    emit!(CompanyRegistered {
        company_id,
        authority: company.authority,
        name,
        symbol,
        token_mint: company.token_mint,
        timestamp: company.created_at,
    });

    Ok(())
}

// New function for admin to create company with initial token supply
pub fn admin_create_company(
    ctx: Context<AdminCreateCompany>,
    name: String,
    symbol: String,
    description: String,
    initial_supply: u64,
    initial_price: u64,
) -> Result<()> {
    // Store account infos before borrowing mutably
    let token_mint_info = ctx.accounts.token_mint.to_account_info();
    let admin_token_account_info = ctx.accounts.admin_token_account.to_account_info();
    let company_info = ctx.accounts.company.to_account_info();
    
    let platform = &mut ctx.accounts.platform;
    let company = &mut ctx.accounts.company;
    
    // Validate admin authority
    require!(ctx.accounts.admin.key() == platform.authority, DefiTradingError::Unauthorized);
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    
    // Validate input
    require!(!name.is_empty(), DefiTradingError::InvalidCompanyData);
    require!(name.len() <= 64, DefiTradingError::InvalidCompanyData);
    require!(!symbol.is_empty(), DefiTradingError::InvalidCompanyData);
    require!(symbol.len() <= 16, DefiTradingError::InvalidCompanyData);
    require!(description.len() <= 256, DefiTradingError::InvalidCompanyData);
    require!(initial_supply > 0, DefiTradingError::InvalidCompanyData);
    require!(initial_price > 0, DefiTradingError::InvalidCompanyData);

    let company_id = platform.total_companies + 1;
    
    company.id = company_id;
    company.authority = ctx.accounts.admin.key();
    company.name = name.clone();
    company.symbol = symbol.clone();
    company.description = description;
    company.verified = true; // Admin created companies are auto-verified
    company.token_mint = ctx.accounts.token_mint.key();
    company.total_supply = initial_supply;
    company.circulating_supply = 0;
    company.market_cap = initial_supply.checked_mul(initial_price).unwrap_or(0);
    company.created_at = Clock::get()?.unix_timestamp;
    company.bump = ctx.bumps.company;

    platform.total_companies = company_id;

    // Mint initial supply to admin token account
    let company_id_bytes = company_id.to_le_bytes();
    let company_bump = company.bump;
    let company_token_mint = company.token_mint;
    
    let seeds = &[
        b"company",
        company_id_bytes.as_ref(),
        &[company_bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = MintTo {
        mint: token_mint_info,
        to: admin_token_account_info,
        authority: company_info,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    
    token::mint_to(cpi_ctx, initial_supply)?;

    // Initialize orderbook for the company
    let orderbook = &mut ctx.accounts.orderbook;
    orderbook.company_id = company_id;
    orderbook.token_mint = company_token_mint;
    orderbook.total_buy_orders = 0;
    orderbook.total_sell_orders = 0;
    orderbook.best_bid = 0;
    orderbook.best_ask = 0;
    orderbook.last_trade_price = initial_price;
    orderbook.total_volume = 0;
    orderbook.created_at = Clock::get()?.unix_timestamp;
    orderbook.last_updated = Clock::get()?.unix_timestamp;
    orderbook.bump = ctx.bumps.orderbook;

    emit!(CompanyCreatedByAdmin {
        company_id,
        admin: ctx.accounts.admin.key(),
        name,
        symbol,
        token_mint: company.token_mint,
        initial_supply,
        initial_price,
        timestamp: company.created_at,
    });

    Ok(())
}

// Function to distribute tokens equally to multiple users
pub fn distribute_tokens(
    ctx: Context<DistributeTokens>,
    company_id: u64,
    recipients: Vec<Pubkey>,
    amount_per_recipient: u64,
) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let company = &ctx.accounts.company;
    let admin = &ctx.accounts.admin;
    let distribution = &mut ctx.accounts.distribution;
    
    // Validate admin authority
    require!(admin.key() == platform.authority, DefiTradingError::Unauthorized);
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(company.id == company_id, DefiTradingError::InvalidCompanyData);
    require!(recipients.len() > 0, DefiTradingError::InvalidTokenDistribution);
    require!(recipients.len() <= 10, DefiTradingError::TooManyRecipients); // Limit for this transaction
    require!(amount_per_recipient > 0, DefiTradingError::InvalidTokenDistribution);

    let total_amount = amount_per_recipient
        .checked_mul(recipients.len() as u64)
        .ok_or(DefiTradingError::ArithmeticOverflow)?;

    // Check if admin has enough tokens
    require!(
        ctx.accounts.admin_token_account.amount >= total_amount,
        DefiTradingError::InsufficientTokens
    );

    // Record distribution
    distribution.company_id = company_id;
    distribution.admin = admin.key();
    distribution.token_mint = company.token_mint;
    distribution.total_distributed = total_amount;
    distribution.recipients_count = recipients.len() as u64;
    distribution.amount_per_recipient = amount_per_recipient;
    distribution.distributed_at = Clock::get()?.unix_timestamp;
    distribution.bump = ctx.bumps.distribution;

    emit!(TokenDistributionStarted {
        company_id,
        admin: admin.key(),
        total_recipients: recipients.len() as u64,
        amount_per_recipient,
        total_amount,
        timestamp: distribution.distributed_at,
    });

    Ok(())
}

// Function to transfer tokens to individual recipient (called multiple times for each recipient)
pub fn transfer_to_recipient(
    ctx: Context<TransferToRecipient>,
    distribution_id: u64,
    amount: u64,
) -> Result<()> {
    let distribution = &ctx.accounts.distribution;
    let admin = &ctx.accounts.admin;
    
    // Validate
    require!(amount == distribution.amount_per_recipient, DefiTradingError::InvalidTokenDistribution);
    require!(admin.key() == distribution.admin, DefiTradingError::Unauthorized);

    // Transfer tokens from admin to recipient
    let cpi_accounts = Transfer {
        from: ctx.accounts.admin_token_account.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.admin.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::transfer(cpi_ctx, amount)?;

    emit!(TokenTransferred {
        from: admin.key(),
        to: ctx.accounts.recipient_token_account.owner,
        amount,
        token_mint: distribution.token_mint,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String)]
pub struct RegisterCompany<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        init,
        payer = authority,
        space = Company::LEN,
        seeds = [
            b"company",
            platform.total_companies.checked_add(1).unwrap().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub company: Account<'info, Company>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = company,
        seeds = [
            b"token_mint",
            platform.total_companies.checked_add(1).unwrap().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub token_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, initial_supply: u64)]
pub struct AdminCreateCompany<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        init,
        payer = admin,
        space = Company::LEN,
        seeds = [
            b"company",
            platform.total_companies.checked_add(1).unwrap().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub company: Account<'info, Company>,
    
    #[account(
        init,
        payer = admin,
        mint::decimals = 6,
        mint::authority = company,
        seeds = [
            b"token_mint",
            platform.total_companies.checked_add(1).unwrap().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = Orderbook::LEN,
        seeds = [
            b"orderbook",
            platform.total_companies.checked_add(1).unwrap().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub orderbook: Account<'info, Orderbook>,
    
    #[account(
        init_if_needed,
        payer = admin,
        token::mint = token_mint,
        token::authority = admin
    )]
    pub admin_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(company_id: u64, recipients: Vec<Pubkey>)]
pub struct DistributeTokens<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        seeds = [b"company", company_id.to_le_bytes().as_ref()],
        bump = company.bump
    )]
    pub company: Account<'info, Company>,

    #[account(
        init,
        payer = admin,
        space = TokenDistribution::LEN,
        seeds = [
            b"distribution",
            company_id.to_le_bytes().as_ref(),
            Clock::get().unwrap().unix_timestamp.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub distribution: Account<'info, TokenDistribution>,
    
    #[account(
        mut,
        constraint = admin_token_account.mint == company.token_mint
    )]
    pub admin_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(distribution_id: u64)]
pub struct TransferToRecipient<'info> {
    #[account(
        seeds = [
            b"distribution",
            distribution.company_id.to_le_bytes().as_ref(),
            distribution.distributed_at.to_le_bytes().as_ref()
        ],
        bump = distribution.bump
    )]
    pub distribution: Account<'info, TokenDistribution>,
    
    #[account(
        mut,
        constraint = admin_token_account.mint == distribution.token_mint
    )]
    pub admin_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = recipient_token_account.mint == distribution.token_mint
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}