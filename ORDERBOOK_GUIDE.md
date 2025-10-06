# DeFi Trading Platform - Orderbook Guide

## 📋 What is the Orderbook?

The orderbook in your DeFi trading platform is a collection of all **sell orders** that users have placed for company shares. It's where users can:

1. **Place sell orders** - List their tokens for sale at a specific price
2. **View active orders** - See all available tokens for purchase
3. **Buy from orders** - Purchase tokens from other users

## 🔍 How to View the Orderbook

### Method 1: Using the Orderbook Viewer Script

```bash
cd /home/rahul/projects/defi_trading_platform
ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json node scripts/view_orderbook_simple.js
```

This will show you:
- 📊 Platform statistics (total companies, trades, offerings)
- 🏢 All registered companies
- 📋 Orderbooks for each company (if initialized)
- 💰 Active sell orders with prices and quantities
- 👥 User portfolios

### Method 2: Using Account Scanner

```bash
node scripts/orderbook_scanner.js
```

This provides a lower-level view of all program accounts.

### Method 3: Using Solana CLI

```bash
# List all program accounts
solana program show FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z

# View specific account details
solana account <ACCOUNT_ADDRESS> --output json
```

## 📝 Orderbook Structure

### Account Types

1. **Company Account** (`company`)
   - Contains company information (name, symbol, token mint)
   - Each company can have its own orderbook

2. **Orderbook Account** (`orderbook`)
   - Tracks statistics for a specific company
   - Contains: total orders, next order ID, company reference

3. **Sell Order Account** (`sellOrder`)
   - Individual sell orders placed by users
   - Contains: order ID, seller, quantity, price, active status

4. **Portfolio Account** (`portfolio`)
   - User's token holdings
   - Required to place sell orders

## 💰 How Sell Orders Work

### Placing a Sell Order

1. **Prerequisites:**
   - User must have a portfolio with tokens
   - User must own tokens they want to sell
   - Orderbook must be initialized for the company

2. **Order Information:**
   - `quantity`: Number of shares to sell
   - `pricePerShare`: Price in lamports (1 SOL = 1,000,000,000 lamports)
   - `isActive`: Whether the order is available for purchase

3. **Example:**
   ```javascript
   // Sell 10 shares at 0.5 SOL each
   const quantity = new anchor.BN(10);
   const pricePerShare = new anchor.BN(500000000); // 0.5 SOL in lamports
   ```

### Order States

- **Active**: Order is available for purchase
- **Inactive**: Order has been filled, cancelled, or expired

## 🚀 Testing the Orderbook

### Current State

Based on the latest scan, your platform has:
- ✅ 1 registered company ("Test Company")
- ❌ 0 active orderbooks (not yet initialized)
- ❌ 0 sell orders
- ❌ 0 user portfolios

### To Create Active Orders

1. **Initialize the full platform:**
   ```bash
   anchor test --skip-local-validator
   ```

2. **Manual order creation:**
   ```javascript
   // In a test file or script:
   await program.methods
     .createSellOrder(quantity, pricePerShare)
     .accounts({
       seller: userKeypair.publicKey,
       company: companyAddress,
       portfolio: userPortfolio,
       orderbook: orderbookAddress,
       // ... other accounts
     })
     .signers([userKeypair])
     .rpc();
   ```

## 📊 Example Orderbook Display

When orders are active, the viewer will show:

```
🏢 COMPANIES FOUND: 1

  Company 1:
    Address: 9HHYfTjybz18GWf1ovArg3Hxas1F3n2kFfc8P3QANBqX
    Name: "Test Company"
    Symbol: TEST
    Total Supply: 1000000 tokens
    Token Mint: BWtDs1seGr6feggd5YCSHJS7oKAVHiDJWeqAMZJTocbk
    📋 Orderbook: QTCyKGWwXJh5GEnyqV2kcfEb32WnUFvo84dLYz7d1FP
    📊 Total Orders: 5
    🆔 Next Order ID: 6
    💰 Active Sell Orders: 3

      Order 1:
        Order ID: 1
        Seller: 7NMJsk55Z1PEcr9xqGFgUSRuHUcCZUk1aVbsndmG4hEt
        Quantity: 100 shares
        Price: 0.500000 SOL per share
        Total Value: 50.000000 SOL
        Active: true
        Created: 10/6/2025, 3:42:10 PM

      Order 2:
        Order ID: 2
        Seller: 8qFGpjR44Z2KGtr8xpDFhSSRvN3CZVk2aWbtndnH5iFs
        Quantity: 50 shares
        Price: 0.750000 SOL per share
        Total Value: 37.500000 SOL
        Active: true
        Created: 10/6/2025, 3:45:22 PM
```

## 🛠 Troubleshooting

### No Orderbooks Found
- **Cause**: Orderbooks are created when the first sell order is placed
- **Solution**: Users need to place sell orders first

### No Sell Orders
- **Cause**: Users don't have tokens or haven't placed orders
- **Solution**: 
  1. Users participate in token offerings to get tokens
  2. Users place sell orders through the trading interface

### No Portfolios
- **Cause**: Users haven't created portfolios yet
- **Solution**: Users must call `createPortfolio()` before trading

## 📱 Integration with Solana Explorer

You can also view accounts on Solana Explorer:

1. **Local Solana Explorer**: http://localhost:3000 (if running)
2. **Solana Explorer with custom RPC**: 
   - Go to https://explorer.solana.com
   - Click settings and set RPC URL to `http://localhost:8899`
   - Search for account addresses

## 💡 Next Steps

1. **Fix the test issues** to populate the orderbook with sample data
2. **Create a web interface** to make orderbook viewing user-friendly
3. **Add real-time updates** to watch orders as they're placed and filled
4. **Implement order matching** to automatically execute trades

The orderbook is the heart of your DeFi trading platform - it's where price discovery happens and users trade with each other!