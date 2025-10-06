use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer, MintTo};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

pub fn create_token_offering(
    ctx: Context<CreateTokenOffering>,
    total_supply: u64,
    price_per_token: u64,
    offering_start: i64,
    offering_end: i64,
) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    let company = &mut ctx.accounts.company;
    let offering = &mut ctx.accounts.token_offering;
    
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(total_supply > 0, DefiTradingError::InvalidOfferingParams);
    require!(price_per_token > 0, DefiTradingError::InvalidOfferingParams);
    require!(offering_start > Clock::get()?.unix_timestamp, DefiTradingError::InvalidTimestamp);
    require!(offering_end > offering_start, DefiTradingError::InvalidTimestamp);
    require!(
        ctx.accounts.authority.key() == company.authority,
        DefiTradingError::Unauthorized
    );

    let offering_id = platform.total_offerings + 1;
    
    offering.id = offering_id;
    offering.company_id = company.id;
    offering.company_authority = company.authority;
    offering.token_mint = company.token_mint;
    offering.total_supply = total_supply;
    offering.remaining_supply = total_supply;
    offering.price_per_token = price_per_token;
    offering.offering_start = offering_start;
    offering.offering_end = offering_end;
    offering.total_raised = 0;
    offering.participants_count = 0;
    offering.status = OfferingStatus::Pending;
    offering.created_at = Clock::get()?.unix_timestamp;
    offering.bump = ctx.bumps.token_offering;

    // Mint tokens to the offering escrow account
    let company_id_bytes = company.id.to_le_bytes();
    let company_bump = company.bump;
    
    // Update company total supply first
    company.total_supply = company.total_supply
        .checked_add(total_supply)
        .ok_or(DefiTradingError::ArithmeticOverflow)?;

    platform.total_offerings = offering_id;

    let seeds = &[
        b"company",
        company_id_bytes.as_ref(),
        &[company_bump],
    ];
    let signer = &[&seeds[..]];
    
    let company_info = ctx.accounts.company.to_account_info();
    let cpi_accounts = MintTo {
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.offering_token_account.to_account_info(),
        authority: company_info,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    
    token::mint_to(cpi_ctx, total_supply)?;

    emit!(TokenOfferingCreated {
        offering_id,
        company_id: offering.company_id,
        company_authority: offering.company_authority,
        token_mint: offering.token_mint,
        total_supply,
        price_per_token,
        offering_start,
        offering_end,
        timestamp: offering.created_at,
    });

    Ok(())
}

pub fn participate_in_offering(
    ctx: Context<ParticipateInOffering>,
    amount: u64,
) -> Result<()> {
    // Store account info before any mutations
    let offering_account_info = ctx.accounts.token_offering.to_account_info();

    let offering = &mut ctx.accounts.token_offering;
    let participation = &mut ctx.accounts.participation;
    let clock = Clock::get()?;
    
    require!(
        clock.unix_timestamp >= offering.offering_start,
        DefiTradingError::OfferingNotStarted
    );
    require!(
        clock.unix_timestamp <= offering.offering_end,
        DefiTradingError::OfferingEnded
    );
    require!(amount > 0, DefiTradingError::InvalidOfferingParams);
    
    let tokens_to_receive = amount
        .checked_div(offering.price_per_token)
        .ok_or(DefiTradingError::DivisionByZero)?;
    
    require!(
        tokens_to_receive <= offering.remaining_supply,
        DefiTradingError::InsufficientTokens
    );

    // Store values before mutations
    let offering_id = offering.id;
    let offering_bump = offering.bump;

    // Update offering status if not active
    if offering.status == OfferingStatus::Pending {
        offering.status = OfferingStatus::Active;
    }

    // Transfer payment from user to platform
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_payment_account.to_account_info(),
        to: ctx.accounts.platform_payment_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::transfer(cpi_ctx, amount)?;

    // Transfer tokens from offering to user
    let offering_id_bytes = offering_id.to_le_bytes();
    let seeds = &[
        b"token_offering",
        offering_id_bytes.as_ref(),
        &[offering_bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.offering_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: offering_account_info,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    
    token::transfer(cpi_ctx, tokens_to_receive)?;

    // Update offering state
    offering.remaining_supply = offering.remaining_supply
        .checked_sub(tokens_to_receive)
        .ok_or(DefiTradingError::ArithmeticUnderflow)?;
    offering.total_raised = offering.total_raised
        .checked_add(amount)
        .ok_or(DefiTradingError::ArithmeticOverflow)?;
    offering.participants_count = offering.participants_count
        .checked_add(1)
        .ok_or(DefiTradingError::ArithmeticOverflow)?;

    // Check if offering is completed
    if offering.remaining_supply == 0 {
        offering.status = OfferingStatus::Completed;
    }

    // Record participation
    participation.user = ctx.accounts.user.key();
    participation.offering_id = offering.id;
    participation.company_id = offering.company_id;
    participation.amount_invested = amount;
    participation.tokens_received = tokens_to_receive;
    participation.participated_at = clock.unix_timestamp;
    participation.bump = ctx.bumps.participation;

    emit!(OfferingParticipated {
        offering_id: offering.id,
        company_id: offering.company_id,
        user: ctx.accounts.user.key(),
        amount_invested: amount,
        tokens_received: tokens_to_receive,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateTokenOffering<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        mut,
        seeds = [b"company", company.id.to_le_bytes().as_ref()],
        bump = company.bump
    )]
    pub company: Account<'info, Company>,
    
    #[account(
        init,
        payer = authority,
        space = TokenOffering::LEN,
        seeds = [
            b"token_offering",
            platform.total_offerings.checked_add(1).unwrap().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub token_offering: Account<'info, TokenOffering>,
    
    #[account(
        mut,
        seeds = [b"token_mint", company.id.to_le_bytes().as_ref()],
        bump
    )]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = token_offering,
        seeds = [
            b"offering_tokens",
            platform.total_offerings.checked_add(1).unwrap().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub offering_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ParticipateInOffering<'info> {
    #[account(
        mut,
        seeds = [b"token_offering", token_offering.id.to_le_bytes().as_ref()],
        bump = token_offering.bump
    )]
    pub token_offering: Account<'info, TokenOffering>,
    
    #[account(
        init,
        payer = user,
        space = OfferingParticipation::LEN,
        seeds = [
            b"participation",
            user.key().as_ref(),
            token_offering.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub participation: Account<'info, OfferingParticipation>,
    
    #[account(
        mut,
        seeds = [
            b"offering_tokens",
            token_offering.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub offering_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_payment_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub platform_payment_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}