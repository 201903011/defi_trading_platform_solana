use anchor_lang::prelude::*;

#[account]
pub struct Platform {
    pub authority: Pubkey,
    pub total_companies: u64,
    pub total_offerings: u64,
    pub total_trades: u64,
    pub platform_fee: u16, // in basis points (e.g., 100 = 1%)
    pub is_paused: bool,
    pub bump: u8,
}

impl Platform {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 + // total_companies
        8 + // total_offerings
        8 + // total_trades
        2 + // platform_fee
        1 + // is_paused
        1; // bump
}

#[account]
pub struct Company {
    pub id: u64,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub verified: bool,
    pub token_mint: Pubkey,
    pub total_supply: u64,
    pub circulating_supply: u64,
    pub market_cap: u64,
    pub created_at: i64,
    pub bump: u8,
}

impl Company {
    pub const LEN: usize = 8 + // discriminator
        8 + // id
        32 + // authority
        4 + 64 + // name (max 64 chars)
        4 + 16 + // symbol (max 16 chars)
        4 + 256 + // description (max 256 chars)
        1 + // verified
        32 + // token_mint
        8 + // total_supply
        8 + // circulating_supply
        8 + // market_cap
        8 + // created_at
        1; // bump
}

#[account]
pub struct TokenOffering {
    pub id: u64,
    pub company_id: u64,
    pub company_authority: Pubkey,
    pub token_mint: Pubkey,
    pub total_supply: u64,
    pub remaining_supply: u64,
    pub price_per_token: u64,
    pub offering_start: i64,
    pub offering_end: i64,
    pub total_raised: u64,
    pub participants_count: u64,
    pub status: OfferingStatus,
    pub created_at: i64,
    pub bump: u8,
}

impl TokenOffering {
    pub const LEN: usize = 8 + // discriminator
        8 + // id
        8 + // company_id
        32 + // company_authority
        32 + // token_mint
        8 + // total_supply
        8 + // remaining_supply
        8 + // price_per_token
        8 + // offering_start
        8 + // offering_end
        8 + // total_raised
        8 + // participants_count
        1 + // status
        8 + // created_at
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OfferingStatus {
    Pending,
    Active,
    Completed,
    Cancelled,
}

#[account]
pub struct Order {
    pub id: u64,
    pub user: Pubkey,
    pub company_id: u64,
    pub token_mint: Pubkey,
    pub order_type: OrderType,
    pub amount: u64,
    pub remaining_amount: u64,
    pub price: u64,
    pub status: OrderStatus,
    pub created_at: i64,
    pub filled_at: Option<i64>,
    pub bump: u8,
}

impl Order {
    pub const LEN: usize = 8 + // discriminator
        8 + // id
        32 + // user
        8 + // company_id
        32 + // token_mint
        1 + // order_type
        8 + // amount
        8 + // remaining_amount
        8 + // price
        1 + // status
        8 + // created_at
        1 + 8 + // filled_at (Option<i64>)
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderType {
    Buy,
    Sell,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderStatus {
    Active,
    PartiallyFilled,
    Filled,
    Cancelled,
}

#[account]
pub struct Trade {
    pub id: u64,
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
    pub executed_at: i64,
    pub bump: u8,
}

impl Trade {
    pub const LEN: usize = 8 + // discriminator
        8 + // id
        32 + // buyer
        32 + // seller
        8 + // company_id
        32 + // token_mint
        8 + // amount
        8 + // price
        8 + // total_value
        8 + // platform_fee
        8 + // buy_order_id
        8 + // sell_order_id
        8 + // executed_at
        1; // bump
}

#[account]
pub struct Portfolio {
    pub user: Pubkey,
    pub total_holdings: u64,
    pub total_value: u64,
    pub total_invested: u64,
    pub total_profit_loss: i64,
    pub holdings_count: u64,
    pub last_updated: i64,
    pub bump: u8,
}

impl Portfolio {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        8 + // total_holdings
        8 + // total_value
        8 + // total_invested
        8 + // total_profit_loss
        8 + // holdings_count
        8 + // last_updated
        1; // bump
}

#[account]
pub struct Holding {
    pub user: Pubkey,
    pub company_id: u64,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub average_price: u64,
    pub total_invested: u64,
    pub current_value: u64,
    pub profit_loss: i64,
    pub last_updated: i64,
    pub bump: u8,
}

impl Holding {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        8 + // company_id
        32 + // token_mint
        8 + // amount
        8 + // average_price
        8 + // total_invested
        8 + // current_value
        8 + // profit_loss
        8 + // last_updated
        1; // bump
}

#[account]
pub struct Escrow {
    pub id: u64,
    pub trade_id: u64,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub status: EscrowStatus,
    pub created_at: i64,
    pub released_at: Option<i64>,
    pub bump: u8,
}

impl Escrow {
    pub const LEN: usize = 8 + // discriminator
        8 + // id
        8 + // trade_id
        32 + // payer
        32 + // recipient
        32 + // token_mint
        8 + // amount
        1 + // status
        8 + // created_at
        1 + 8 + // released_at (Option<i64>)
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Active,
    Released,
    Cancelled,
}

#[account]
pub struct OfferingParticipation {
    pub user: Pubkey,
    pub offering_id: u64,
    pub company_id: u64,
    pub amount_invested: u64,
    pub tokens_received: u64,
    pub participated_at: i64,
    pub bump: u8,
}

impl OfferingParticipation {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        8 + // offering_id
        8 + // company_id
        8 + // amount_invested
        8 + // tokens_received
        8 + // participated_at
        1; // bump
}