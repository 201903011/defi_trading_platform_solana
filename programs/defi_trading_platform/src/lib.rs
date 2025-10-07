use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

declare_id!("FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z");

pub mod state;
pub mod instructions;
pub mod errors;
pub mod events;

use state::*;
use instructions::*;
use errors::*;
use events::*;

#[program]
pub mod defi_trading_platform {
    use super::*;

    // Platform initialization
    pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
        instructions::initialize_platform(ctx)
    }

    // Admin functions
    pub fn pause_platform(ctx: Context<PausePlatform>) -> Result<()> {
        instructions::pause_platform(ctx)
    }

    pub fn unpause_platform(ctx: Context<UnpausePlatform>) -> Result<()> {
        instructions::unpause_platform(ctx)
    }

    pub fn update_platform_fee(ctx: Context<UpdatePlatformFee>, new_fee: u16) -> Result<()> {
        instructions::update_platform_fee(ctx, new_fee)
    }

    pub fn verify_company(ctx: Context<VerifyCompany>, company_id: u64) -> Result<()> {
        instructions::verify_company(ctx, company_id)
    }

    // Company management
    pub fn register_company(
        ctx: Context<RegisterCompany>, 
        name: String, 
        symbol: String,
        description: String
    ) -> Result<()> {
        instructions::register_company(ctx, name, symbol, description)
    }

    // Admin company creation with initial supply
    pub fn admin_create_company(
        ctx: Context<AdminCreateCompany>,
        name: String,
        symbol: String,
        description: String,
        initial_supply: u64,
        initial_price: u64,
    ) -> Result<()> {
        instructions::admin_create_company(ctx, name, symbol, description, initial_supply, initial_price)
    }

    // Token distribution functions
    pub fn distribute_tokens(
        ctx: Context<DistributeTokens>,
        company_id: u64,
        recipients: Vec<Pubkey>,
        amount_per_recipient: u64,
    ) -> Result<()> {
        instructions::distribute_tokens(ctx, company_id, recipients, amount_per_recipient)
    }

    pub fn transfer_to_recipient(
        ctx: Context<TransferToRecipient>,
        distribution_id: u64,
        amount: u64,
    ) -> Result<()> {
        instructions::transfer_to_recipient(ctx, distribution_id, amount)
    }

    // Token offering functions
    pub fn create_token_offering(
        ctx: Context<CreateTokenOffering>,
        total_supply: u64,
        price_per_token: u64,
        offering_start: i64,
        offering_end: i64,
    ) -> Result<()> {
        instructions::create_token_offering(ctx, total_supply, price_per_token, offering_start, offering_end)
    }

    pub fn participate_in_offering(
        ctx: Context<ParticipateInOffering>,
        amount: u64,
    ) -> Result<()> {
        instructions::participate_in_offering(ctx, amount)
    }

    // Trading functions
    pub fn create_sell_order(
        ctx: Context<CreateSellOrder>,
        amount: u64,
        price: u64,
    ) -> Result<()> {
        instructions::create_sell_order(ctx, amount, price)
    }

    pub fn create_buy_order(
        ctx: Context<CreateBuyOrder>,
        amount: u64,
        price: u64,
    ) -> Result<()> {
        instructions::create_buy_order(ctx, amount, price)
    }

    pub fn execute_trade(
        ctx: Context<ExecuteTrade>,
        sell_order_id: u64,
        buy_order_id: u64,
        amount: u64,
    ) -> Result<()> {
        instructions::execute_trade(ctx, sell_order_id, buy_order_id, amount)
    }

    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        instructions::cancel_order(ctx)
    }

    // Enhanced trading functions
    pub fn create_limit_order(
        ctx: Context<CreateLimitOrder>,
        order_type: OrderType,
        amount: u64,
        price: u64,
    ) -> Result<()> {
        instructions::create_limit_order(ctx, order_type, amount, price)
    }

    pub fn create_market_order(
        ctx: Context<CreateMarketOrder>,
        order_type: OrderType,
        amount: u64,
    ) -> Result<()> {
        instructions::create_market_order(ctx, order_type, amount)
    }

    pub fn match_orders(
        ctx: Context<MatchOrders>,
        buy_order_id: u64,
        sell_order_id: u64,
        amount: u64,
    ) -> Result<()> {
        instructions::match_orders(ctx, buy_order_id, sell_order_id, amount)
    }

    pub fn calculate_market_depth(
        ctx: Context<CalculateMarketDepth>,
        company_id: u64,
    ) -> Result<()> {
        instructions::calculate_market_depth(ctx, company_id)
    }

    // Portfolio management
    pub fn create_portfolio(ctx: Context<CreatePortfolio>) -> Result<()> {
        instructions::create_portfolio(ctx)
    }

    pub fn update_portfolio(ctx: Context<UpdatePortfolio>) -> Result<()> {
        instructions::update_portfolio(ctx)
    }

    // Escrow functions
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        amount: u64,
        trade_id: u64,
    ) -> Result<()> {
        instructions::create_escrow(ctx, amount, trade_id)
    }

    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        instructions::release_escrow(ctx)
    }
}
