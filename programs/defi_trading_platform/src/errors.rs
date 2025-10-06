use anchor_lang::prelude::*;

#[error_code]
pub enum DefiTradingError {
    #[msg("Platform is currently paused")]
    PlatformPaused,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Invalid company data")]
    InvalidCompanyData,
    
    #[msg("Company not found")]
    CompanyNotFound,
    
    #[msg("Company already exists")]
    CompanyAlreadyExists,
    
    #[msg("Invalid token offering parameters")]
    InvalidOfferingParams,
    
    #[msg("Token offering not active")]
    OfferingNotActive,
    
    #[msg("Token offering already ended")]
    OfferingEnded,
    
    #[msg("Token offering not started yet")]
    OfferingNotStarted,
    
    #[msg("Insufficient tokens available")]
    InsufficientTokens,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Invalid order parameters")]
    InvalidOrderParams,
    
    #[msg("Order not found")]
    OrderNotFound,
    
    #[msg("Order already filled")]
    OrderAlreadyFilled,
    
    #[msg("Order already cancelled")]
    OrderAlreadyCancelled,
    
    #[msg("Cannot trade with yourself")]
    SelfTrade,
    
    #[msg("Price mismatch")]
    PriceMismatch,
    
    #[msg("Invalid trade amount")]
    InvalidTradeAmount,
    
    #[msg("Portfolio not found")]
    PortfolioNotFound,
    
    #[msg("Holding not found")]
    HoldingNotFound,
    
    #[msg("Escrow not found")]
    EscrowNotFound,
    
    #[msg("Escrow already released")]
    EscrowAlreadyReleased,
    
    #[msg("Invalid escrow status")]
    InvalidEscrowStatus,
    
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    
    #[msg("Arithmetic underflow")]
    ArithmeticUnderflow,
    
    #[msg("Division by zero")]
    DivisionByZero,
    
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    
    #[msg("Platform fee too high")]
    PlatformFeeTooHigh,
    
    #[msg("Token account mismatch")]
    TokenAccountMismatch,
    
    #[msg("Mint authority mismatch")]
    MintAuthorityMismatch,
    
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    
    #[msg("Token transfer failed")]
    TokenTransferFailed,
    
    #[msg("Already participated in offering")]
    AlreadyParticipated,
    
    #[msg("Minimum investment not met")]
    MinimumInvestmentNotMet,
    
    #[msg("Maximum investment exceeded")]
    MaximumInvestmentExceeded,
}