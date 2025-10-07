# 🏢 DeFi Trading Platform - Complete Process Explanation

Your DeFi trading platform enables companies to raise capital and users to trade shares through a sophisticated smart contract system. Here's how each major process works:

## 🏗️ System Architecture Overview

```
Platform Authority
    ↓
Platform Account (Global State)
    ↓
Companies → Token Offerings → User Portfolios → Trading Orders
```

---

## 🏢 1. Company Registration Process

### How It Works

Companies register on your platform to issue and manage their tokens (shares).

### Step-by-Step Process

```rust
pub fn register_company(
    ctx: Context<RegisterCompany>,
    name: String,
    symbol: String,
    description: String,
) -> Result<()>
```

#### 1. **Input Validation**
- ✅ Company name (max 64 characters)
- ✅ Stock symbol (max 16 characters, like "AAPL")
- ✅ Description (max 256 characters)
- ✅ Platform must not be paused

#### 2. **Company Account Creation**
```rust
// Platform assigns unique company ID
let company_id = platform.total_companies + 1;

// Company data structure
company.id = company_id;
company.authority = ctx.accounts.authority.key();  // Company owner
company.name = name.clone();
company.symbol = symbol.clone();
company.description = description;
company.verified = false;  // Admin verification required
company.token_mint = ctx.accounts.token_mint.key();  // SPL Token mint
company.total_supply = 0;  // Initially zero
company.circulating_supply = 0;
company.market_cap = 0;
company.created_at = Clock::get()?.unix_timestamp;
```

#### 3. **Token Mint Setup**
- 🪙 Creates SPL Token mint account
- 🔐 Company authority controls minting
- 📊 Tracks total and circulating supply

#### 4. **Platform State Update**
```rust
platform.total_companies = company_id;  // Increment global counter
```

### What Gets Created

| Account Type | Purpose | Address Generation |
|--------------|---------|-------------------|
| **Company Account** | Stores company data | PDA: `["company", company_id_bytes]` |
| **Token Mint** | SPL Token for shares | Standard SPL mint account |

### Example Usage

```javascript
await program.methods
  .registerCompany(
    "Awesome Corp",      // Company name
    "AWSM",             // Stock symbol
    "A revolutionary tech company"  // Description
  )
  .accounts({
    platform: platformPda,
    company: companyPda,
    authority: companyAuthority.publicKey,
    tokenMint: tokenMintPda,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([companyAuthority])
  .rpc();
```

---

## 💰 2. Initial Token Offering (ITO) Process

### How It Works

Companies create token offerings to sell shares to the public, similar to an IPO but on blockchain.

### Step-by-Step Process

```rust
pub fn create_token_offering(
    ctx: Context<CreateTokenOffering>,
    total_supply: u64,
    price_per_token: u64,
    offering_start: i64,
    offering_end: i64,
) -> Result<()>
```

#### 1. **Offering Parameters**
```rust
// Validation checks
require!(total_supply > 0, DefiTradingError::InvalidOfferingParams);
require!(price_per_token > 0, DefiTradingError::InvalidOfferingParams);
require!(offering_start > Clock::get()?.unix_timestamp, DefiTradingError::InvalidTimestamp);
require!(offering_end > offering_start, DefiTradingError::InvalidTimestamp);
```

#### 2. **Token Minting**
```rust
// Mint tokens to offering escrow account
company.total_supply = company.total_supply
    .checked_add(total_supply)
    .ok_or(DefiTradingError::ArithmeticOverflow)?;

// Mint to escrow using company authority
token::mint_to(cpi_ctx, total_supply)?;
```

#### 3. **Offering Account Creation**
```rust
offering.id = offering_id;
offering.company_id = company.id;
offering.token_mint = company.token_mint;
offering.total_supply = total_supply;
offering.remaining_supply = total_supply;  // Available for purchase
offering.price_per_token = price_per_token;  // In lamports
offering.offering_start = offering_start;
offering.offering_end = offering_end;
offering.status = OfferingStatus::Pending;
```

### Participation Process

```rust
pub fn participate_in_offering(
    ctx: Context<ParticipateInOffering>,
    amount: u64,
) -> Result<()>
```

#### 1. **Validation**
```rust
// Check offering is active
require!(
    current_time >= offering.offering_start && current_time <= offering.offering_end,
    DefiTradingError::OfferingNotStarted
);

// Check sufficient supply
require!(amount <= offering.remaining_supply, DefiTradingError::InsufficientSupply);

// Calculate total cost
let total_cost = amount
    .checked_mul(offering.price_per_token)
    .ok_or(DefiTradingError::ArithmeticOverflow)?;
```

#### 2. **Payment Processing**
```rust
// Transfer payment (SOL) from user to offering
let cpi_accounts = Transfer {
    from: ctx.accounts.user_payment_account.to_account_info(),
    to: ctx.accounts.offering_payment_account.to_account_info(),
    authority: ctx.accounts.user.to_account_info(),
};
token::transfer(cpi_ctx, total_cost)?;
```

#### 3. **Token Distribution**
```rust
// Transfer tokens from offering escrow to user
let cpi_accounts = Transfer {
    from: ctx.accounts.offering_token_account.to_account_info(),
    to: ctx.accounts.user_token_account.to_account_info(),
    authority: ctx.accounts.token_offering.to_account_info(),
};
token::transfer(cpi_ctx_tokens, amount)?;
```

#### 4. **Portfolio Update**
```rust
// Update user's portfolio
portfolio.token_balance = portfolio.token_balance
    .checked_add(amount)
    .ok_or(DefiTradingError::ArithmeticOverflow)?;

portfolio.total_invested = portfolio.total_invested
    .checked_add(total_cost)
    .ok_or(DefiTradingError::ArithmeticOverflow)?;
```

### Example ITO Flow

```javascript
// 1. Company creates offering
await program.methods
  .createTokenOffering(
    new anchor.BN(1000000),  // 1M tokens
    new anchor.BN(1000000),  // 1 SOL per token (in lamports)
    new anchor.BN(Date.now() / 1000 + 3600),  // Start in 1 hour
    new anchor.BN(Date.now() / 1000 + 86400)  // End in 24 hours
  )
  .rpc();

// 2. User participates
await program.methods
  .participateInOffering(
    new anchor.BN(100)  // Buy 100 tokens
  )
  .rpc();
```

---

## 📈 3. Trading System (Buy/Sell Orders)

### How Trading Works

Your platform uses an orderbook system where users place buy/sell orders that can be matched.

### Sell Order Process

```rust
pub fn create_sell_order(
    ctx: Context<CreateSellOrder>,
    amount: u64,
    price: u64,
) -> Result<()>
```

#### 1. **Prerequisites**
- ✅ User must own tokens (have balance)
- ✅ User must have active portfolio
- ✅ Platform must not be paused

#### 2. **Token Escrow**
```rust
// Check user has enough tokens
require!(
    ctx.accounts.user_token_account.amount >= amount,
    DefiTradingError::InsufficientTokens
);

// Move tokens to escrow account
let cpi_accounts = Transfer {
    from: ctx.accounts.user_token_account.to_account_info(),
    to: ctx.accounts.order_escrow_account.to_account_info(),
    authority: ctx.accounts.user.to_account_info(),
};
token::transfer(cpi_ctx, amount)?;
```

#### 3. **Order Creation**
```rust
order.id = order_id;
order.user = ctx.accounts.user.key();
order.company_id = ctx.accounts.company.id;
order.order_type = OrderType::Sell;
order.amount = amount;
order.remaining_amount = amount;  // Unfilled amount
order.price = price;  // Price per token in lamports
order.status = OrderStatus::Active;
order.created_at = Clock::get()?.unix_timestamp;
```

### Buy Order Process

```rust
pub fn create_buy_order(
    ctx: Context<CreateBuyOrder>,
    amount: u64,
    price: u64,
) -> Result<()>
```

#### 1. **Payment Calculation**
```rust
let total_cost = amount
    .checked_mul(price)
    .ok_or(DefiTradingError::ArithmeticOverflow)?;

// Check user has enough payment tokens (SOL)
require!(
    ctx.accounts.user_payment_account.amount >= total_cost,
    DefiTradingError::InsufficientFunds
);
```

#### 2. **Payment Escrow**
```rust
// Escrow payment until order is matched
let cpi_accounts = Transfer {
    from: ctx.accounts.user_payment_account.to_account_info(),
    to: ctx.accounts.order_escrow_account.to_account_info(),
    authority: ctx.accounts.user.to_account_info(),
};
token::transfer(cpi_ctx, total_cost)?;
```

### Trade Execution

```rust
pub fn execute_trade(
    ctx: Context<ExecuteTrade>,
    sell_order_id: u64,
    buy_order_id: u64,
    amount: u64,
) -> Result<()>
```

#### 1. **Order Matching**
```rust
// Validate orders can be matched
require!(sell_order.status == OrderStatus::Active, DefiTradingError::OrderNotActive);
require!(buy_order.status == OrderStatus::Active, DefiTradingError::OrderNotActive);
require!(buy_order.price >= sell_order.price, DefiTradingError::PriceMismatch);
require!(amount <= sell_order.remaining_amount, DefiTradingError::InsufficientAmount);
require!(amount <= buy_order.remaining_amount, DefiTradingError::InsufficientAmount);
```

#### 2. **Asset Exchange**
```rust
// Calculate trade value at seller's price
let trade_value = amount
    .checked_mul(sell_order.price)
    .ok_or(DefiTradingError::ArithmeticOverflow)?;

// Transfer tokens from sell escrow to buyer
let cpi_accounts = Transfer {
    from: ctx.accounts.sell_order_escrow.to_account_info(),
    to: ctx.accounts.buyer_token_account.to_account_info(),
    authority: ctx.accounts.sell_order.to_account_info(),
};
token::transfer(cpi_ctx_tokens, amount)?;

// Transfer payment from buy escrow to seller
let cpi_accounts = Transfer {
    from: ctx.accounts.buy_order_escrow.to_account_info(),
    to: ctx.accounts.seller_payment_account.to_account_info(),
    authority: ctx.accounts.buy_order.to_account_info(),
};
token::transfer(cpi_ctx_payment, trade_value)?;
```

#### 3. **Order Updates**
```rust
// Update remaining amounts
sell_order.remaining_amount = sell_order.remaining_amount
    .checked_sub(amount)
    .ok_or(DefiTradingError::ArithmeticUnderflow)?;

buy_order.remaining_amount = buy_order.remaining_amount
    .checked_sub(amount)
    .ok_or(DefiTradingError::ArithmeticUnderflow)?;

// Mark orders as filled if complete
if sell_order.remaining_amount == 0 {
    sell_order.status = OrderStatus::Filled;
    sell_order.filled_at = Some(Clock::get()?.unix_timestamp);
}

if buy_order.remaining_amount == 0 {
    buy_order.status = OrderStatus::Filled;
    buy_order.filled_at = Some(Clock::get()?.unix_timestamp);
}
```

---

## 🔄 Complete Trading Flow Example

### 1. Company Registration
```javascript
// Awesome Corp registers
const tx1 = await program.methods
  .registerCompany("Awesome Corp", "AWSM", "Revolutionary tech")
  .rpc();
```

### 2. Initial Token Offering
```javascript
// Create offering: 1M tokens at 0.001 SOL each
const tx2 = await program.methods
  .createTokenOffering(
    new anchor.BN(1000000),  // 1M tokens
    new anchor.BN(1000000),  // 0.001 SOL per token
    startTime,
    endTime
  )
  .rpc();

// Alice buys 1000 tokens
const tx3 = await program.methods
  .participateInOffering(new anchor.BN(1000))
  .rpc();
```

### 3. Trading Activity
```javascript
// Alice places sell order: 100 tokens at 0.002 SOL each
const tx4 = await program.methods
  .createSellOrder(
    new anchor.BN(100),      // 100 tokens
    new anchor.BN(2000000)   // 0.002 SOL per token
  )
  .rpc();

// Bob places buy order: 50 tokens at 0.002 SOL each
const tx5 = await program.methods
  .createBuyOrder(
    new anchor.BN(50),       // 50 tokens
    new anchor.BN(2000000)   // 0.002 SOL per token
  )
  .rpc();

// Trade gets executed automatically or manually
const tx6 = await program.methods
  .executeTrade(
    sellOrderId,
    buyOrderId,
    new anchor.BN(50)  // Trade 50 tokens
  )
  .rpc();
```

---

## 📊 Account Structure Summary

| Account Type | Purpose | PDA Seeds |
|--------------|---------|-----------|
| **Platform** | Global state | `["platform"]` |
| **Company** | Company data | `["company", company_id]` |
| **Token Offering** | ITO details | `["offering", company_id, offering_id]` |
| **Portfolio** | User holdings | `["portfolio", user_pubkey]` |
| **Sell Order** | Sell order data | `["order", user_pubkey, order_id]` |
| **Buy Order** | Buy order data | `["order", user_pubkey, order_id]` |
| **Trade** | Completed trade | `["trade", trade_id]` |

---

## 💡 Key Features

### ✅ **Security Features**
- **Escrow System**: All assets held in escrow during orders
- **Validation**: Comprehensive input validation
- **Authority Checks**: Only authorized users can perform actions
- **Atomic Transactions**: All-or-nothing execution

### ✅ **Economic Features**
- **Price Discovery**: Market-driven pricing through orderbook
- **Liquidity**: Users provide liquidity by placing orders
- **Fee System**: Platform fees on transactions
- **Supply Management**: Controlled token minting and supply tracking

### ✅ **Transparency Features**
- **Event Emission**: All major actions emit events
- **Public Data**: Company and offering data publicly viewable
- **Order History**: Complete trade history maintained
- **Real-time Updates**: Live orderbook and portfolio tracking

This creates a complete DeFi ecosystem where companies can raise capital and users can trade shares in a decentralized, transparent manner! 🚀