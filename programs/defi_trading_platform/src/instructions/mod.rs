use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer, MintTo};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

pub mod platform;
pub mod company;
pub mod token_offering;
pub mod trading;
pub mod portfolio;
pub mod escrow;

pub use platform::*;
pub use company::*;
pub use token_offering::*;
pub use trading::*;
pub use portfolio::*;
pub use escrow::*;

// Re-export all instruction functions
pub use platform::{initialize_platform, pause_platform, unpause_platform, update_platform_fee, verify_company};
pub use company::register_company;
pub use token_offering::{create_token_offering, participate_in_offering};
pub use trading::{create_sell_order, create_buy_order, execute_trade, cancel_order};
pub use portfolio::{create_portfolio, update_portfolio};
pub use escrow::{create_escrow, release_escrow};