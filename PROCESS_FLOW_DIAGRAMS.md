# 🎯 DeFi Trading Platform - Process Flow Diagrams

## 🏢 1. Company Registration Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Company       │    │   Input         │    │   Validation    │
│   Authority     │───▶│   • Name        │───▶│   • Name ≤ 64   │
│   (Signer)      │    │   • Symbol      │    │   • Symbol ≤ 16 │
│                 │    │   • Description │    │   • Desc ≤ 256  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Company       │    │   SPL Token     │    │   Platform      │
│   Account       │◀───│   Mint          │◀───│   State         │
│   Created       │    │   Created       │    │   Updated       │
│   (PDA)         │    │   (Company=Auth)│    │   (companies++)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Result:**
- ✅ Company registered with unique ID
- ✅ SPL token mint created for shares
- ✅ Platform tracks total companies
- ⏳ Company awaits admin verification

---

## 💰 2. Initial Token Offering (ITO) Flow

### Phase 1: Offering Creation

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Company       │    │   Offering      │    │   Token         │
│   Authority     │───▶│   Parameters    │───▶│   Minting       │
│   (Signer)      │    │   • Supply      │    │   • Mint to     │
│                 │    │   • Price       │    │     Escrow      │
│                 │    │   • Start/End   │    │   • Update      │
│                 │    │     Times       │    │     Supply      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Offering      │    │   Escrow        │    │   Platform      │
│   Account       │◀───│   Token         │◀───│   State         │
│   Created       │    │   Account       │    │   Updated       │
│   (Status:      │    │   (Holds tokens)│    │   (offerings++) │
│    Pending)     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Phase 2: User Participation

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User          │    │   Payment       │    │   Token         │
│   (Wants to     │───▶│   Processing    │───▶│   Transfer      │
│    buy tokens)  │    │   • SOL to      │    │   • Tokens to   │
│                 │    │     Offering    │    │     User        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User          │    │   Offering      │    │   Portfolio     │
│   Token         │◀───│   Updated       │◀───│   Updated       │
│   Account       │    │   • Supply--    │    │   • Balance++   │
│   (Has tokens)  │    │   • Raised++    │    │   • Invested++  │
│                 │    │   • Participants++   │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 📈 3. Trading System Flow

### Phase 1: Order Placement

#### Sell Order Creation
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Token Holder  │    │   Token         │    │   Sell Order    │
│   (Wants to     │───▶│   Escrow        │───▶│   Account       │
│    sell)        │    │   • Tokens      │    │   • Created     │
│                 │    │     locked      │    │   • Status:     │
│                 │    │   • User→Escrow │    │     Active      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### Buy Order Creation
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SOL Holder    │    │   Payment       │    │   Buy Order     │
│   (Wants to     │───▶│   Escrow        │───▶│   Account       │
│    buy)         │    │   • SOL         │    │   • Created     │
│                 │    │     locked      │    │   • Status:     │
│                 │    │   • User→Escrow │    │     Active      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Phase 2: Order Matching & Execution

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sell Order    │    │   Order         │    │   Buy Order     │
│   • Price: X    │───▶│   Matching      │◀───│   • Price: Y    │
│   • Amount: A   │    │   • X ≤ Y ?     │    │   • Amount: B   │
│   • Active      │    │   • A ≤ B ?     │    │   • Active      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼ (If Match Found)
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Token         │    │   Trade         │    │   Payment       │
│   Transfer      │───▶│   Execution     │◀───│   Transfer      │
│   • Escrow→     │    │   • Amount: Z   │    │   • Escrow→     │
│     Buyer       │    │   • Price: X    │    │     Seller      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Orders        │    │   Trade         │    │   Portfolios    │
│   Updated       │───▶│   Record        │◀───│   Updated       │
│   • Remaining-- │    │   Created       │    │   • Balances    │
│   • Status      │    │   • Permanent   │    │     adjusted    │
│     updated     │    │     record      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🎯 4. Complete User Journey

### New Company Journey
```
1. 🏢 Register Company
   │
   ├─▶ 2. 💰 Create Token Offering
   │   │
   │   ├─▶ 3. 👥 Users Participate (ITO)
   │   │   │
   │   │   └─▶ 4. 📈 Secondary Trading Begins
   │   │
   │   └─▶ Wait for offering period
   │
   └─▶ Wait for admin verification
```

### User Trading Journey
```
1. 💰 Participate in ITO
   │
   ├─▶ 2. 📊 Receive Tokens
   │   │
   │   ├─▶ 3a. 📤 Place Sell Order
   │   │    │
   │   │    └─▶ 4a. 🤝 Execute Trade (when matched)
   │   │
   │   └─▶ 3b. 💰 Hold Tokens
   │        │
   │        └─▶ 4b. 📈 Monitor Portfolio
   │
   └─▶ OR: 💸 Buy from Secondary Market
       │
       ├─▶ 📥 Place Buy Order
       │
       └─▶ 🤝 Execute Trade (when matched)
```

---

## 🔄 5. Account State Transitions

### Order Status Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PENDING   │───▶│   ACTIVE    │───▶│   FILLED    │
│   (Created) │    │ (In market) │    │ (Complete)  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       │                   ▼                   │
       │            ┌─────────────┐            │
       │            │  CANCELLED  │            │
       └───────────▶│ (Withdrawn) │◀───────────┘
                    └─────────────┘
```

### Offering Status Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PENDING   │───▶│   ACTIVE    │───▶│  COMPLETED  │
│ (Not started)│    │(During period)│  │(Successful) │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   
       │                   ▼                   
       │            ┌─────────────┐            
       │            │   EXPIRED   │            
       └───────────▶│  (Failed)   │            
                    └─────────────┘            
```

---

## 📊 6. Data Flow Summary

### Key Data Relationships
```
Platform
├── Companies (1:N)
│   ├── Token Mint (1:1)
│   ├── Token Offerings (1:N)
│   └── Orders (1:N)
├── Users (1:N)
│   ├── Portfolios (1:N per company)
│   ├── Orders (1:N)
│   └── Trade History (1:N)
└── Trades (1:N)
    ├── Buy Order (N:1)
    ├── Sell Order (N:1)
    └── Participants (2 users)
```

### Event Emission Flow
```
Action ───▶ Smart Contract ───▶ Event Emitted ───▶ Frontend Update
  │              │                    │                    │
  │              │                    │                    ▼
  │              │                    │             ┌─────────────┐
  │              │                    │             │   User      │
  │              │                    │             │   Interface │
  │              │                    │             │   Updates   │
  │              │                    │             └─────────────┘
  │              │                    │
  │              │                    ▼
  │              │             ┌─────────────┐
  │              │             │   Indexer   │
  │              │             │   Services  │
  │              │             │   (Optional)│
  │              │             └─────────────┘
  │              │
  │              ▼
  │       ┌─────────────┐
  │       │   Account   │
  │       │   State     │
  │       │   Updates   │
  │       └─────────────┘
  │
  ▼
┌─────────────┐
│   Chain     │
│   State     │
│   Updated   │
└─────────────┘
```

This visual representation shows how your DeFi platform orchestrates complex financial operations through smart contracts, ensuring security, transparency, and efficiency at every step! 🚀