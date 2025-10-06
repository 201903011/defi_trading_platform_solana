use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::events::*;

pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    
    platform.authority = ctx.accounts.authority.key();
    platform.total_companies = 0;
    platform.total_offerings = 0;
    platform.total_trades = 0;
    platform.platform_fee = 100; // 1% default fee
    platform.is_paused = false;
    platform.bump = ctx.bumps.platform;

    emit!(PlatformInitialized {
        authority: platform.authority,
        platform_fee: platform.platform_fee,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

pub fn pause_platform(ctx: Context<PausePlatform>) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    
    require!(
        ctx.accounts.authority.key() == platform.authority,
        DefiTradingError::Unauthorized
    );
    
    platform.is_paused = true;
    
    msg!("Platform paused by authority: {}", ctx.accounts.authority.key());
    
    Ok(())
}

pub fn unpause_platform(ctx: Context<UnpausePlatform>) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    
    require!(
        ctx.accounts.authority.key() == platform.authority,
        DefiTradingError::Unauthorized
    );
    
    platform.is_paused = false;
    
    msg!("Platform unpaused by authority: {}", ctx.accounts.authority.key());
    
    Ok(())
}

pub fn update_platform_fee(ctx: Context<UpdatePlatformFee>, new_fee: u16) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    
    require!(
        ctx.accounts.authority.key() == platform.authority,
        DefiTradingError::Unauthorized
    );
    
    require!(new_fee <= 1000, DefiTradingError::PlatformFeeTooHigh); // Max 10%
    
    let old_fee = platform.platform_fee;
    platform.platform_fee = new_fee;
    
    msg!("Platform fee updated from {} to {} basis points", old_fee, new_fee);
    
    Ok(())
}

pub fn verify_company(ctx: Context<VerifyCompany>, company_id: u64) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let company = &mut ctx.accounts.company;
    
    require!(
        ctx.accounts.authority.key() == platform.authority,
        DefiTradingError::Unauthorized
    );
    
    require!(company.id == company_id, DefiTradingError::CompanyNotFound);
    
    company.verified = true;
    
    msg!("Company {} ({}) verified", company.name, company.symbol);
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = authority,
        space = Platform::LEN,
        seeds = [b"platform"],
        bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PausePlatform<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UnpausePlatform<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePlatformFee<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(company_id: u64)]
pub struct VerifyCompany<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        mut,
        seeds = [b"company", company_id.to_le_bytes().as_ref()],
        bump = company.bump
    )]
    pub company: Account<'info, Company>,
    
    pub authority: Signer<'info>,
}