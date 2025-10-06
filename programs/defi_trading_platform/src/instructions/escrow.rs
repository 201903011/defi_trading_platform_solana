use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

pub fn create_escrow(
    ctx: Context<CreateEscrow>,
    amount: u64,
    trade_id: u64,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let platform = &ctx.accounts.platform;
    
    require!(!platform.is_paused, DefiTradingError::PlatformPaused);
    require!(amount > 0, DefiTradingError::InvalidTradeAmount);
    
    let escrow_id = platform.total_trades + 1; // Using total_trades as counter
    
    escrow.id = escrow_id;
    escrow.trade_id = trade_id;
    escrow.payer = ctx.accounts.payer.key();
    escrow.recipient = ctx.accounts.recipient.key();
    escrow.token_mint = ctx.accounts.token_mint.key();
    escrow.amount = amount;
    escrow.status = EscrowStatus::Active;
    escrow.created_at = Clock::get()?.unix_timestamp;
    escrow.released_at = None;
    escrow.bump = ctx.bumps.escrow;

    // Transfer tokens to escrow account
    let cpi_accounts = Transfer {
        from: ctx.accounts.payer_token_account.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::transfer(cpi_ctx, amount)?;

    emit!(EscrowCreated {
        escrow_id,
        trade_id,
        payer: escrow.payer,
        recipient: escrow.recipient,
        token_mint: escrow.token_mint,
        amount,
        timestamp: escrow.created_at,
    });

    Ok(())
}

pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
    // Store account info before any mutations
    let escrow_info = ctx.accounts.escrow.to_account_info();

    let escrow = &mut ctx.accounts.escrow;
    
    require!(escrow.status == EscrowStatus::Active, DefiTradingError::InvalidEscrowStatus);
    require!(
        ctx.accounts.authority.key() == escrow.payer || 
        ctx.accounts.authority.key() == escrow.recipient,
        DefiTradingError::Unauthorized
    );

    // Store values before borrowing
    let escrow_id = escrow.id;
    let escrow_amount = escrow.amount;
    let escrow_bump = escrow.bump;

    // Transfer tokens from escrow to recipient
    let escrow_id_bytes = escrow_id.to_le_bytes();
    let seeds = &[
        b"escrow",
        escrow_id_bytes.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_token_account.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: escrow_info,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    
    token::transfer(cpi_ctx, escrow_amount)?;

    escrow.status = EscrowStatus::Released;
    escrow.released_at = Some(Clock::get()?.unix_timestamp);

    emit!(EscrowReleased {
        escrow_id: escrow.id,
        trade_id: escrow.trade_id,
        payer: escrow.payer,
        recipient: escrow.recipient,
        amount: escrow_amount,
        timestamp: escrow.released_at.unwrap(),
    });

    Ok(())
}

pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
    // Store account info before any mutations
    let escrow_info = ctx.accounts.escrow.to_account_info();

    let escrow = &mut ctx.accounts.escrow;
    
    require!(escrow.status == EscrowStatus::Active, DefiTradingError::InvalidEscrowStatus);
    require!(
        ctx.accounts.authority.key() == escrow.payer,
        DefiTradingError::Unauthorized
    );

    // Store values before borrowing
    let escrow_id = escrow.id;
    let escrow_amount = escrow.amount;
    let escrow_bump = escrow.bump;

    // Return tokens to payer
    let escrow_id_bytes = escrow_id.to_le_bytes();
    let seeds = &[
        b"escrow",
        escrow_id_bytes.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_token_account.to_account_info(),
        to: ctx.accounts.payer_token_account.to_account_info(),
        authority: escrow_info,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    
    token::transfer(cpi_ctx, escrow_amount)?;

    escrow.status = EscrowStatus::Cancelled;
    escrow.released_at = Some(Clock::get()?.unix_timestamp);

    Ok(())
}

#[derive(Accounts)]
#[instruction(amount: u64, trade_id: u64)]
pub struct CreateEscrow<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        init,
        payer = payer,
        space = Escrow::LEN,
        seeds = [
            b"escrow",
            (platform.total_trades + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        init,
        payer = payer,
        token::mint = token_mint,
        token::authority = escrow,
        seeds = [
            b"escrow_tokens",
            (platform.total_trades + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = payer_token_account.mint == token_mint.key()
    )]
    pub payer_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, anchor_spl::token::Mint>,
    
    /// CHECK: This is just a reference for the escrow recipient
    pub recipient: AccountInfo<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.id.to_le_bytes().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        mut,
        seeds = [b"escrow_tokens", escrow.id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = recipient_token_account.mint == escrow.token_mint
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.id.to_le_bytes().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        mut,
        seeds = [b"escrow_tokens", escrow.id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = payer_token_account.mint == escrow.token_mint
    )]
    pub payer_token_account: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}