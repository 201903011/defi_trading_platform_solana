# 📊 TATA COMPANY DEFI TRADING PLATFORM - MARKET DEPTH & USER MONITORING GUIDE

## 🎯 How to View Market Depth

### 📈 Method 1: Real-time Market Depth Viewer
```bash
node scripts/market_depth_viewer.js
```
- Shows current orderbook status
- Displays bid/ask spreads
- Shows market statistics
- Updates with real trading data

### 📊 Method 2: Simulated Market Depth Demo
```bash
node scripts/market_depth_demo.js
```
- Demonstrates how orderbook would look
- Simulates order execution
- Shows trading flow visualization
- Educational overview of market mechanics

## 👥 All User Addresses for Transaction Monitoring

### 📍 Platform Addresses
- **Program ID:** `FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z`
- **Platform:** `72V6BBKUh1R8yFsNo1DW517qrTDKzwAUJTf5LWzzZuGo`
- **TATA Company:** `9HHYfTjybz18GWf1ovArg3Hxas1F3n2kFfc8P3QANBqX`
- **Token Mint:** `BWtDs1seGr6feggd5YCSHJS7oKAVHiDJWeqAMZJTocbk`

### 👤 Trading User Addresses

#### 🔴 User 1 - Primary Seller
- **Address:** `4z6pgr3ak8yYn6i6QarRxyA1gmrhj11UiTtqjEqfyaaH`
- **Portfolio:** `3iJaQ8FSicpxcwcRmCj6LRjnVvnCAjDDqXwTAkp2QJ5r`
- **Trading Plan:** SELL 50 TATA @ 120 SOL (Limit Order)
- **Initial Tokens:** 250 TATA
- **Explorer:** http://localhost:8899/address/4z6pgr3ak8yYn6i6QarRxyA1gmrhj11UiTtqjEqfyaaH

#### 🔴 User 2 - Secondary Seller
- **Address:** `AbvXtt1Ak9GRnATJ9vr4foJoMGUTNzFSew9vgwS9VxhM`
- **Portfolio:** `EqhCvqzZW8GKmxUbFw3Y1kjBKtcwHt59apYBPQwQbCSM`
- **Trading Plan:** SELL 70 TATA @ 110 SOL (Limit Order)
- **Initial Tokens:** 250 TATA
- **Explorer:** http://localhost:8899/address/AbvXtt1Ak9GRnATJ9vr4foJoMGUTNzFSew9vgwS9VxhM

#### 🟢 User 3 - Market Buyer
- **Address:** `4MNZfG3cKdGXtg27799PVNaTNVQQrU96k8rNtHKRMYgc`
- **Portfolio:** `BJ9XCmjQV2uFYPKsQA44WbAkZym7qDnXhK1T4HriTF6U`
- **Trading Plan:** BUY 30 TATA @ Market Price
- **Initial Tokens:** 250 TATA
- **Explorer:** http://localhost:8899/address/4MNZfG3cKdGXtg27799PVNaTNVQQrU96k8rNtHKRMYgc

#### 🟢 User 4 - Limit Buyer
- **Address:** `8AhTgp9JjZZu5X7DWGtECN7frbtXVR5ndM5Hm2RuCPMP`
- **Portfolio:** `DxBhmi9ELcUZHqhTpxvmdeHVXAATPYURYKHLkzudvRrR`
- **Trading Plan:** BUY 25 TATA @ 125 SOL (Limit Order)
- **Initial Tokens:** 250 TATA
- **Explorer:** http://localhost:8899/address/8AhTgp9JjZZu5X7DWGtECN7frbtXVR5ndM5Hm2RuCPMP

#### 🟢 User 5 - Market Buyer
- **Address:** `Hje8FjB6TMc79MCfMdLFiWwt1iosF5hfJ6tYqcT7jejz`
- **Portfolio:** `2gnw48dRoZJAVMdbhVJ8SHxd5xyx7bmBQ52u64nkNeAG`
- **Trading Plan:** BUY 30 TATA @ Market Price
- **Initial Tokens:** 0 TATA
- **Explorer:** http://localhost:8899/address/Hje8FjB6TMc79MCfMdLFiWwt1iosF5hfJ6tYqcT7jejz

#### 🟢 User 6 - Limit Buyer
- **Address:** `mpgivYefECA7L11Kf87Krwo9N2VR8zuE25EvaVFWtKH`
- **Portfolio:** `DQxt8A41ZmiMiw93FCS9fzFURiiDxGk9dpCF3nGUF3V9`
- **Trading Plan:** BUY 10 TATA @ 100 SOL (Limit Order)
- **Initial Tokens:** 0 TATA
- **Explorer:** http://localhost:8899/address/mpgivYefECA7L11Kf87Krwo9N2VR8zuE25EvaVFWtKH

## 🌐 Localhost Transaction Monitoring

### 🔍 Using Solana Explorer
1. Go to: https://explorer.solana.com/
2. Click network dropdown (top right)
3. Select "Custom RPC"
4. Enter: `http://localhost:8899`
5. Search for any address above to monitor transactions

### 📊 Available Monitoring Scripts

#### 🎯 Generate Fresh User Addresses
```bash
node scripts/user_address_tracker.js
```
- Creates new user accounts with funding
- Generates portfolio addresses
- Saves all addresses to JSON file

#### 📈 View Current Market Status
```bash
node scripts/market_depth_viewer.js
```
- Real-time orderbook data
- Market depth analysis
- Trading statistics

#### 🔄 Create Trading Activity
```bash
node scripts/tata_complete_scenario.js
```
- Creates actual trading orders
- Executes the full TATA scenario
- Generates blockchain transactions

#### 📋 View All Platform Data
```bash
node scripts/get_addresses.js
```
- Shows all important addresses
- Platform overview
- Quick explorer links

## 📊 Expected Market Depth Structure

When orders are active, the market depth will show:

### 🔴 Ask Side (Sell Orders) - Ascending Price
```
1.  70 TATA @ 110 SOL - User 2
2.  50 TATA @ 120 SOL - User 1
```

### 🟢 Bid Side (Buy Orders) - Descending Price
```
1.  25 TATA @ 125 SOL - User 4
2.  10 TATA @ 100 SOL - User 6
```

### 📈 Market Statistics
- **Best Ask:** 110 SOL
- **Best Bid:** 125 SOL
- **Spread:** Cross-market (bid > ask) = arbitrage opportunity
- **Total Ask Volume:** 120 TATA
- **Total Bid Volume:** 35 TATA

## ⚡ Market Order Execution Flow

### 🟢 User 3: Market BUY 30 TATA
- Matches with User 2's sell order at 110 SOL
- Executes: 30 TATA for 3,300 SOL

### 🟢 User 5: Market BUY 30 TATA
- Matches with remaining User 2 order at 110 SOL
- Executes: 30 TATA for 3,300 SOL

## 🎯 Quick Commands Reference

```bash
# Generate user addresses and fund accounts
node scripts/user_address_tracker.js

# View current market depth
node scripts/market_depth_viewer.js

# Create trading orders
node scripts/tata_complete_scenario.js

# View simulated market depth
node scripts/market_depth_demo.js

# Check platform addresses
node scripts/get_addresses.js
```

## 📁 Saved Data Files

All generated addresses are saved to:
- `scripts/user_addresses.json` - Complete user data with addresses, roles, and trading plans

This file contains all user addresses, portfolio addresses, funding transactions, and can be used for systematic monitoring of all trading activity.

---

## ✅ Summary

You now have:
1. **📊 Market Depth Viewer** - Real-time orderbook monitoring
2. **👥 User Address Tracker** - All 6 trading participants with addresses
3. **🌐 Localhost Explorer Setup** - Direct links for transaction monitoring
4. **⚡ Trading Simulation** - Visual demonstration of order execution
5. **📁 Complete Address Database** - Saved JSON file with all addresses

Run any of the scripts above to interact with the TATA Company DeFi Trading Platform and monitor market depth in real-time!