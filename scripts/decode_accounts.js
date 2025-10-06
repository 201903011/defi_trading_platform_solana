const { PublicKey, Connection } = require("@solana/web3.js");

// Program ID from our deployment
const programId = new PublicKey("FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z");
const connection = new Connection("http://localhost:8899", "confirmed");

function decodeCompanyData(data) {
    try {
        // Company account structure:
        // authority: 32 bytes
        // id: 8 bytes (at offset 32)
        // name length: 4 bytes (at offset 40)
        // name: variable
        // symbol length: 4 bytes
        // symbol: variable
        // description length: 4 bytes  
        // description: variable
        // ... other fields

        const authority = new PublicKey(data.slice(0, 32));
        const id = data.readBigUInt64LE(32);

        let offset = 40;
        const nameLength = data.readUInt32LE(offset);
        offset += 4;
        const name = data.slice(offset, offset + nameLength).toString('utf8');
        offset += nameLength;

        const symbolLength = data.readUInt32LE(offset);
        offset += 4;
        const symbol = data.slice(offset, offset + symbolLength).toString('utf8');
        offset += symbolLength;

        const descriptionLength = data.readUInt32LE(offset);
        offset += 4;
        const description = data.slice(offset, offset + descriptionLength).toString('utf8');

        return { authority, id, name, symbol, description };
    } catch (error) {
        return { error: error.message };
    }
}

function decodePortfolioData(data) {
    try {
        // Portfolio structure:
        // user: 32 bytes
        // total_holdings: 8 bytes
        // total_value: 8 bytes
        // bump: 1 byte
        // ... holdings array

        const user = new PublicKey(data.slice(0, 32));
        const totalHoldings = data.readBigUInt64LE(32);
        const totalValue = data.readBigUInt64LE(40);
        const bump = data.readUInt8(48);

        return { user, totalHoldings, totalValue, bump };
    } catch (error) {
        return { error: error.message };
    }
}

function decodeOrderData(data) {
    try {
        // Order structure might be:
        // order_id: 8 bytes
        // user: 32 bytes  
        // company_id: 8 bytes
        // amount: 8 bytes
        // price: 8 bytes
        // order_type: 1 byte (0=Buy, 1=Sell)
        // status: 1 byte
        // created_at: 8 bytes
        // bump: 1 byte

        const orderId = data.readBigUInt64LE(0);
        const user = new PublicKey(data.slice(8, 40));
        const companyId = data.readBigUInt64LE(40);
        const amount = data.readBigUInt64LE(48);
        const price = data.readBigUInt64LE(56);
        const orderType = data.readUInt8(64);
        const status = data.readUInt8(65);
        const createdAt = data.readBigUInt64LE(66);

        return {
            orderId,
            user,
            companyId,
            amount,
            price,
            orderType: orderType === 0 ? 'BUY' : 'SELL',
            status: status === 0 ? 'OPEN' : status === 1 ? 'FILLED' : 'CANCELLED',
            createdAt
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function decodeAllAccounts() {
    console.log("=== 📋 Detailed Account Information ===\n");

    try {
        const accounts = await connection.getProgramAccounts(programId);

        for (const account of accounts) {
            const address = account.pubkey.toString();
            const data = account.account.data;
            const size = data.length;

            console.log(`🔍 Account: ${address}`);
            console.log(`💰 Balance: ${account.account.lamports / 1e9} SOL`);
            console.log(`📏 Size: ${size} bytes`);

            // Decode based on size and try to identify type
            if (size === 68) {
                console.log("📊 Type: PLATFORM ACCOUNT");
                try {
                    const authority = new PublicKey(data.slice(0, 32));
                    const totalCompanies = data.readBigUInt64LE(40);
                    const totalOfferings = data.readBigUInt64LE(48);
                    const totalTrades = data.readBigUInt64LE(56);
                    const platformFee = data.readUInt16LE(64);
                    const isPaused = data.readUInt8(66);

                    console.log(`   🏛️  Authority: ${authority.toString()}`);
                    console.log(`   🏢 Companies: ${totalCompanies}`);
                    console.log(`   💰 Offerings: ${totalOfferings}`);
                    console.log(`   📈 Trades: ${totalTrades}`);
                    console.log(`   💳 Platform Fee: ${platformFee / 100}%`);
                    console.log(`   ⏸️  Paused: ${isPaused === 1 ? 'Yes' : 'No'}`);
                } catch (e) {
                    console.log("   ❌ Error decoding platform data");
                }

            } else if (size === 462) {
                console.log("🏪 Type: COMPANY ACCOUNT");
                const decoded = decodeCompanyData(data);
                if (decoded.error) {
                    console.log(`   ❌ Error: ${decoded.error}`);
                } else {
                    console.log(`   🆔 ID: ${decoded.id}`);
                    console.log(`   📛 Name: "${decoded.name}"`);
                    console.log(`   🎫 Symbol: "${decoded.symbol}"`);
                    console.log(`   📝 Description: "${decoded.description}"`);
                    console.log(`   👤 Authority: ${decoded.authority.toString()}`);
                }

            } else if (size === 89) {
                console.log("👤 Type: PORTFOLIO ACCOUNT");
                const decoded = decodePortfolioData(data);
                if (decoded.error) {
                    console.log(`   ❌ Error: ${decoded.error}`);
                } else {
                    console.log(`   👤 User: ${decoded.user.toString()}`);
                    console.log(`   📊 Total Holdings: ${decoded.totalHoldings}`);
                    console.log(`   💵 Total Value: ${decoded.totalValue}`);
                    console.log(`   🔢 Bump: ${decoded.bump}`);
                }

            } else if (size === 132 || size === 154) {
                console.log("📋 Type: POSSIBLE ORDER/OFFERING ACCOUNT");

                // Try to decode as order
                const orderDecoded = decodeOrderData(data);
                if (!orderDecoded.error && orderDecoded.orderId < 1000000) { // Sanity check
                    console.log("   🛒 ORDER DATA:");
                    console.log(`   🆔 Order ID: ${orderDecoded.orderId}`);
                    console.log(`   👤 User: ${orderDecoded.user.toString()}`);
                    console.log(`   🏢 Company ID: ${orderDecoded.companyId}`);
                    console.log(`   📦 Amount: ${orderDecoded.amount}`);
                    console.log(`   💰 Price: ${orderDecoded.price}`);
                    console.log(`   🔄 Type: ${orderDecoded.orderType}`);
                    console.log(`   📊 Status: ${orderDecoded.status}`);
                    console.log(`   ⏰ Created: ${orderDecoded.createdAt}`);
                } else {
                    console.log("   📄 Raw data preview:");
                    console.log(`   ${data.slice(0, 64).toString('hex')}`);
                }

            } else {
                console.log(`❓ Type: UNKNOWN (${size} bytes)`);
                console.log(`   📄 Data preview: ${data.slice(0, 32).toString('hex')}...`);
            }

            console.log(`   🌐 Explorer: https://explorer.solana.com/address/${address}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`);
            console.log("");
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

decodeAllAccounts().catch(console.error);