# 🔍 Viewing Your DeFi Trading Platform on Solana Explorer

## 📍 Your Platform Addresses

### **Main Program**
- **Program ID**: `FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z`
- **Status**: ✅ Deployed and Active
- **Network**: Localhost (http://localhost:8899)

### **Platform Components**
- **Platform Account**: `72V6BBKUh1R8yFsNo1DW517qrTDKzwAUJTf5LWzzZuGo`
- **Test Company**: `9HHYfTjybz18GWf1ovArg3Hxas1F3n2kFfc8P3QANBqX`
- **Company Token Mint**: `BWtDs1seGr6feggd5YCSHJS7oKAVHiDJWeqAMZJTocbk`
- **Token Offering #1**: `4TTK1j7Y9upAKhspBt1Ws4SphMqNT4A7xHPsWr38WoBs`
- **Your Portfolio**: `DbxWrwX31y2k1nvzMZBaoz1ySWzXD7LTGKtQerxYkoRk`

## 🌐 Method 1: Solana Explorer (Recommended)

1. **Go to**: https://explorer.solana.com/
2. **Change Network**: Click the dropdown in top-right corner
3. **Select**: "Custom RPC"
4. **Enter URL**: `http://localhost:8899`
5. **Search**: Paste any address from above

### **Direct Links** (click when your validator is running):
- [**View Program**](https://explorer.solana.com/address/FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899)
- [**View Platform**](https://explorer.solana.com/address/72V6BBKUh1R8yFsNo1DW517qrTDKzwAUJTf5LWzzZuGo?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899)
- [**View Test Company**](https://explorer.solana.com/address/9HHYfTjybz18GWf1ovArg3Hxas1F3n2kFfc8P3QANBqX?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899)

## 🔧 Method 2: Solscan (Alternative)

1. **Go to**: https://solscan.io/
2. **Settings Icon** (top-right) → **Switch Network**
3. **Custom** → Enter: `http://localhost:8899`
4. **Search** for any address above

## 📊 Method 3: Command Line Inspection

```bash
# View program info
solana program show FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z

# View platform account data
solana account 72V6BBKUh1R8yFsNo1DW517qrTDKzwAUJTf5LWzzZuGo

# View company account (contains "Test Company" data)
solana account 9HHYfTjybz18GWf1ovArg3Hxas1F3n2kFfc8P3QANBqX

# View recent transactions
solana transaction-history FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z
```

## 📋 What You'll See in Explorer

### **Program Account**
- **Type**: BPF Upgradeable Program
- **Owner**: BPFLoaderUpgradeab1e11111111111111111111111
- **Size**: ~642KB of compiled smart contract code
- **Authority**: Your wallet address

### **Platform Account**
- **Owner**: Your DeFi Program
- **Data**: Platform settings, counters, fee rates
- **Balance**: Rent-exempt amount (~0.00136 SOL)

### **Company Account**
- **Data**: "Test Company", "TEST" symbol, description
- **Owner**: Your DeFi Program  
- **Size**: 462 bytes of company information

### **Token Mint**
- **Type**: SPL Token Mint
- **Decimals**: 6
- **Supply**: Managed by your platform
- **Mint Authority**: Company's PDA

## 🚀 What to Look For

1. **Transactions**: All your test transactions (platform init, company registration, etc.)
2. **Account Data**: Raw bytes showing your program's state
3. **Token Operations**: Minting, transfers, account creation
4. **Program Logs**: Debug information from your smart contract

## ⚠️ Important Notes

- **Validator Must Be Running**: Make sure `solana-test-validator` is active
- **Port 8899**: Your validator runs on this port by default
- **Localhost Only**: This data only exists on your local blockchain
- **Reset Warning**: Data disappears if you restart validator with `--reset`

## 🔄 Quick Script to Get Addresses

Run this anytime to get fresh addresses:
```bash
cd /home/rahul/projects/defi_trading_platform
node scripts/get_addresses.js
```

---

**🎉 Your DeFi platform is fully deployed and viewable!** All the components (platform, companies, token offerings, portfolios) are live on your local Solana blockchain.