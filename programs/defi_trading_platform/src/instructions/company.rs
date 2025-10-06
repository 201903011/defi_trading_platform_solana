use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Mint, MintTo};
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