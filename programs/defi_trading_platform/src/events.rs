use anchor_lang::prelude::*;

#[event]
pub struct PlatformInitialized {
    pub authority: Pubkey,
    pub platform_fee: u16,
    pub timestamp: i64,
}

#[event]
pub struct CompanyRegistered {
    pub company_id: u64,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub token_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TokenOfferingCreated {
    pub offering_id: u64,
    pub company_id: u64,
    pub company_authority: Pubkey,
    pub token_mint: Pubkey,
    pub total_supply: u64,
    pub price_per_token: u64,
    pub offering_start: i64,
    pub offering_end: i64,
    pub timestamp: i64,
}

#[event]
pub struct OfferingParticipated {
    pub offering_id: u64,
    pub company_id: u64,
    pub user: Pubkey,
    pub amount_invested: u64,
    pub tokens_received: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderCreated {
    pub order_id: u64,
    pub user: Pubkey,
    pub company_id: u64,
    pub token_mint: Pubkey,
    pub order_type: String, // "Buy" or "Sell"
    pub amount: u64,
    pub price: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderCancelled {
    pub order_id: u64,
    pub user: Pubkey,
    pub company_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct TradeExecuted {
    pub trade_id: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub company_id: u64,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub price: u64,
    pub total_value: u64,
    pub platform_fee: u64,
    pub buy_order_id: u64,
    pub sell_order_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct PortfolioCreated {
    pub user: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PortfolioUpdated {
    pub user: Pubkey,
    pub total_holdings: u64,
    pub total_value: u64,
    pub total_invested: u64,
    pub total_profit_loss: i64,
    pub timestamp: i64,
}

#[event]
pub struct HoldingUpdated {
    pub user: Pubkey,
    pub company_id: u64,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub average_price: u64,
    pub total_invested: u64,
    pub current_value: u64,
    pub profit_loss: i64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowCreated {
    pub escrow_id: u64,
    pub trade_id: u64,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowReleased {
    pub escrow_id: u64,
    pub trade_id: u64,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// New events for enhanced functionality
#[event]
pub struct CompanyCreatedByAdmin {
    pub company_id: u64,
    pub admin: Pubkey,
    pub name: String,
    pub symbol: String,
    pub token_mint: Pubkey,
    pub initial_supply: u64,
    pub initial_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenDistributionStarted {
    pub company_id: u64,
    pub admin: Pubkey,
    pub total_recipients: u64,
    pub amount_per_recipient: u64,
    pub total_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenTransferred {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct LimitOrderCreated {
    pub order_id: u64,
    pub user: Pubkey,
    pub company_id: u64,
    pub order_type: String,
    pub amount: u64,
    pub price: u64,
    pub timestamp: i64,
}

#[event]
pub struct MarketOrderCreated {
    pub order_id: u64,
    pub user: Pubkey,
    pub company_id: u64,
    pub order_type: String,
    pub amount: u64,
    pub execution_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrdersMatched {
    pub trade_id: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub company_id: u64,
    pub amount: u64,
    pub price: u64,
    pub total_value: u64,
    pub platform_fee: u64,
    pub buy_order_id: u64,
    pub sell_order_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct MarketDepthCalculated {
    pub company_id: u64,
    pub orderbook: Pubkey,
    pub total_buy_volume: u64,
    pub total_sell_volume: u64,
    pub timestamp: i64,
}