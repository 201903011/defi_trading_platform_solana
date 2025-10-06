# DeFi Trading Platform

A comprehensive decentralized finance (DeFi) trading platform built on Solana using the Anchor framework. This platform enables companies to issue tokens through Initial Token Offerings (ITOs) and facilitates peer-to-peer trading with advanced portfolio management features.

## 🚀 Features

### Core Functionality
- **Company Registration**: Register companies and issue their tokens
- **Initial Token Offerings (ITOs)**: Companies can raise funds by issuing tokens
- **Decentralized Trading**: Peer-to-peer trading with order book functionality
- **Portfolio Management**: Track holdings, profits/losses, and portfolio metrics
- **Secure Escrow**: Protected trades with automatic escrow handling
- **Platform Administration**: Admin controls for platform management

### Smart Contract Features
- **Multi-Contract Architecture**: Modular design with separate contracts for different functionalities
- **Token Standard Compliance**: SPL token integration for seamless trading
- **Event Emission**: Comprehensive event logging for transparency
- **Error Handling**: Detailed error codes and validation
- **Security Controls**: Platform pause/unpause, verification system
- **Fee Management**: Configurable platform fees with limits

## 📋 Architecture

### Smart Contracts Structure

```
├── Platform Management      # Core platform administration
├── Company Registry        # Company registration and verification
├── Token Offerings         # Initial Token Offering (ITO) functionality
├── Trading Engine          # Order creation and trade execution
├── Portfolio Management    # User portfolio tracking
└── Escrow System          # Secure trade settlement
```

### Key Program Data Accounts

- **Platform**: Global platform state and configuration
- **Company**: Company profiles and token information
- **TokenOffering**: ITO details and participation tracking
- **Order**: Buy/sell orders with escrow integration
- **Trade**: Completed trade records
- **Portfolio**: User portfolio summaries
- **Holding**: Individual token holdings per user
- **Escrow**: Secure fund holding for trades

## 🛠️ Installation & Setup

### Prerequisites
- Rust 1.70+
- Solana CLI 1.16+
- Anchor Framework 0.31+
- Node.js 16+
- Yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd defi_trading_platform
```

2. **Install dependencies**
```bash
# Install Rust dependencies
anchor build

# Install Node.js dependencies
yarn install
```

3. **Configure Solana**
```bash
# Set to localnet for development
solana config set --url localhost

# Generate a new keypair if needed
solana-keygen new

# Start local validator
solana-test-validator
```

4. **Build and deploy**
```bash
# Build the program
anchor build

# Deploy to localnet
anchor deploy

# Run migrations
anchor run deploy
```

## 🔧 Usage

### 1. Initialize Platform

```typescript
const platformPda = PublicKey.findProgramAddressSync(
  [Buffer.from("platform")],
  program.programId
)[0];

await program.methods
  .initializePlatform()
  .accounts({
    platform: platformPda,
    authority: authority.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([authority])
  .rpc();
```

### 2. Register a Company

```typescript
const companyId = 1;
const [companyPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("company"), Buffer.from(companyId.toString().padStart(8, "0"), "hex")],
  program.programId
);

await program.methods
  .registerCompany("My Company", "MYCO", "Description of my company")
  .accounts({
    platform: platformPda,
    company: companyPda,
    // ... other accounts
  })
  .rpc();
```

### 3. Create Token Offering

```typescript
await program.methods
  .createTokenOffering(
    new BN(1000000), // total supply
    new BN(1000000), // price per token (6 decimals)
    new BN(startTime),
    new BN(endTime)
  )
  .accounts({
    // ... accounts
  })
  .rpc();
```

### 4. Trading

```typescript
// Create sell order
await program.methods
  .createSellOrder(
    new BN(1000), // amount
    new BN(1100000) // price
  )
  .accounts({
    // ... accounts
  })
  .rpc();

// Create buy order
await program.methods
  .createBuyOrder(
    new BN(500), // amount
    new BN(1200000) // price
  )
  .accounts({
    // ... accounts
  })
  .rpc();
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
anchor test

# Run specific test file
anchor test --test-file tests/defi_trading_platform.ts

# Run with detailed output
anchor test -- --verbose
```

### Test Coverage

- Platform initialization and configuration
- Company registration and verification
- Token offering creation and participation
- Order creation (buy/sell)
- Trade execution and settlement
- Portfolio management and updates
- Escrow creation and release
- Error handling and edge cases

## 🔐 Security Features

### Access Control
- **Platform Authority**: Administrative control over platform operations
- **Company Authority**: Control over company-specific operations
- **User Authorization**: Secure user-specific operations

### Safety Mechanisms
- **Platform Pause**: Emergency pause functionality
- **Input Validation**: Comprehensive parameter validation
- **Overflow Protection**: Safe arithmetic operations
- **Token Account Verification**: Strict token account matching
- **Escrow Protection**: Secure fund holding during trades

### Error Handling
- Detailed error codes for debugging
- Input sanitization and validation
- State consistency checks
- Access control enforcement

## 📊 Platform Economics

### Fee Structure
- **Platform Fee**: Configurable fee (default 1%, max 10%)
- **Fee Collection**: Automatic fee deduction during trades
- **Fee Updates**: Admin-controlled fee adjustments

### Token Economics
- **ITO Participation**: Users buy tokens with payment currency
- **Trading**: Peer-to-peer token exchange
- **Portfolio Tracking**: Real-time profit/loss calculation
- **Market Making**: Decentralized order book

## 🌐 Deployment

### Localnet (Development)
```bash
anchor build
anchor deploy
anchor run deploy
```

### Devnet
```bash
solana config set --url devnet
anchor build
anchor deploy --provider.cluster devnet
```

### Mainnet (Production)
```bash
solana config set --url mainnet-beta
anchor build
anchor deploy --provider.cluster mainnet-beta
```

## 🔮 Future Enhancements

### Planned Features
- **Advanced Order Types**: Stop-loss, limit orders, market orders
- **Liquidity Pools**: Automated market making
- **Governance**: Token holder voting mechanisms
- **Analytics Dashboard**: Real-time trading analytics
- **Mobile SDK**: React Native integration
- **Cross-Chain Bridge**: Multi-blockchain support

### Optimization Areas
- **Gas Optimization**: Reduce transaction costs
- **Batch Processing**: Multiple operations in single transaction
- **State Compression**: Optimize account storage
- **Indexing**: Enhanced query capabilities

## 📝 API Reference

### Program Instructions

| Instruction | Description | Accounts Required |
|-------------|-------------|-------------------|
| `initialize_platform` | Initialize the trading platform | Platform, Authority |
| `register_company` | Register a new company | Platform, Company, TokenMint, Authority |
| `create_token_offering` | Create an ITO | Platform, Company, TokenOffering, Authority |
| `participate_in_offering` | Participate in ITO | TokenOffering, User, TokenAccounts |
| `create_sell_order` | Create sell order | Platform, Company, Order, User |
| `create_buy_order` | Create buy order | Platform, Company, Order, User |
| `execute_trade` | Execute matching orders | Orders, Trade, TokenAccounts |
| `cancel_order` | Cancel existing order | Order, User |
| `create_portfolio` | Create user portfolio | Portfolio, User |
| `update_portfolio` | Update portfolio metrics | Portfolio, Holdings, User |

### Events

- `PlatformInitialized`
- `CompanyRegistered`
- `TokenOfferingCreated`
- `OfferingParticipated`
- `OrderCreated`
- `TradeExecuted`
- `PortfolioCreated`
- `EscrowCreated`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Development Guidelines
- Follow Rust and TypeScript best practices
- Write comprehensive tests
- Document new features
- Maintain backward compatibility
- Use semantic versioning

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions and support:
- Create an issue on GitHub
- Join our Discord community
- Check the documentation wiki

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. Use at your own risk. This is experimental software and should be thoroughly tested before any production use.

---

**Note**: This platform is designed for educational and development purposes. Ensure proper security audits before deploying to mainnet with real funds.