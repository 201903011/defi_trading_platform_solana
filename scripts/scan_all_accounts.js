const { PublicKey, Connection } = require("@solana/web3.js");

// Program ID from our deployment
const programId = new PublicKey("FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z");
const connection = new Connection("http://localhost:8899", "confirmed");

async function findPortfoliosAndOrders() {
    console.log("=== 🔍 Finding All Portfolios & Orders ===\n");
    console.log("🔎 Scanning all accounts owned by our program...\n");

    try {
        // Get all accounts owned by our program
        const accounts = await connection.getProgramAccounts(programId);

        console.log(`📊 Found ${accounts.length} accounts owned by our program\n`);

        let portfolioCount = 0;
        let orderCount = 0;
        let offeringCount = 0;
        let companyCount = 0;
        let otherCount = 0;

        for (const account of accounts) {
            const accountData = account.account.data;
            const address = account.pubkey.toString();

            // Try to determine account type based on data size and patterns
            const dataSize = accountData.length;

            console.log(`📋 Account: ${address}`);
            console.log(`   Size: ${dataSize} bytes`);
            console.log(`   Balance: ${account.account.lamports / 1e9} SOL`);

            // Analyze account type based on size and data patterns
            if (dataSize === 68) {
                console.log("   🏢 Type: Platform Account");

                // Parse platform data
                try {
                    const totalCompanies = accountData.readBigUInt64LE(40);
                    const totalOfferings = accountData.readBigUInt64LE(48);
                    const totalTrades = accountData.readBigUInt64LE(56);
                    const platformFee = accountData.readUInt16LE(64);

                    console.log(`   📊 Stats: ${totalCompanies} companies, ${totalOfferings} offerings, ${totalTrades} trades`);
                    console.log(`   💳 Fee: ${platformFee / 100}%`);
                } catch (e) {
                    console.log("   ⚠️  Could not parse platform data");
                }

            } else if (dataSize === 462) {
                console.log("   🏪 Type: Company Account");
                companyCount++;

                // Try to extract company name (starts at byte 44, length at byte 40)
                try {
                    const nameLength = accountData.readUInt32LE(40);
                    if (nameLength > 0 && nameLength < 100) {
                        const nameBytes = accountData.slice(44, 44 + nameLength);
                        const companyName = nameBytes.toString('utf8');
                        console.log(`   🏷️  Company Name: "${companyName}"`);

                        const symbolLength = accountData.readUInt32LE(44 + nameLength);
                        if (symbolLength > 0 && symbolLength < 20) {
                            const symbolBytes = accountData.slice(48 + nameLength, 48 + nameLength + symbolLength);
                            const symbol = symbolBytes.toString('utf8');
                            console.log(`   🎫 Symbol: "${symbol}"`);
                        }
                    }
                } catch (e) {
                    console.log("   ⚠️  Could not parse company data");
                }

            } else if (dataSize === 297) {
                console.log("   💰 Type: Token Offering Account");
                offeringCount++;

                // Try to parse offering data
                try {
                    const offeringId = accountData.readBigUInt64LE(8);
                    const companyId = accountData.readBigUInt64LE(16);
                    const totalSupply = accountData.readBigUInt64LE(24);
                    const pricePerToken = accountData.readBigUInt64LE(32);

                    console.log(`   🆔 Offering ID: ${offeringId}, Company ID: ${companyId}`);
                    console.log(`   📦 Supply: ${totalSupply}, Price: ${pricePerToken}`);
                } catch (e) {
                    console.log("   ⚠️  Could not parse offering data");
                }

            } else if (dataSize === 89) {
                console.log("   👤 Type: Portfolio Account");
                portfolioCount++;

                // Try to parse portfolio data
                try {
                    // User pubkey is first 32 bytes
                    const userPubkey = new PublicKey(accountData.slice(0, 32));
                    const totalHoldings = accountData.readBigUInt64LE(32);
                    const totalValue = accountData.readBigUInt64LE(40);

                    console.log(`   👤 User: ${userPubkey.toString()}`);
                    console.log(`   📊 Holdings: ${totalHoldings}, Value: ${totalValue}`);
                } catch (e) {
                    console.log("   ⚠️  Could not parse portfolio data");
                }

            } else if (dataSize === 170) {
                console.log("   📋 Type: Order Account");
                orderCount++;

                // Try to parse order data
                try {
                    const orderId = accountData.readBigUInt64LE(8);
                    const userPubkey = new PublicKey(accountData.slice(16, 48));
                    const companyId = accountData.readBigUInt64LE(48);
                    const amount = accountData.readBigUInt64LE(56);
                    const price = accountData.readBigUInt64LE(64);
                    const orderType = accountData.readUInt8(72); // 0 = Buy, 1 = Sell
                    const status = accountData.readUInt8(73); // 0 = Open, 1 = Filled, 2 = Cancelled

                    const orderTypeStr = orderType === 0 ? "BUY" : "SELL";
                    const statusStr = status === 0 ? "OPEN" : status === 1 ? "FILLED" : "CANCELLED";

                    console.log(`   🆔 Order ID: ${orderId} (${orderTypeStr})`);
                    console.log(`   👤 User: ${userPubkey.toString()}`);
                    console.log(`   📊 Amount: ${amount}, Price: ${price}`);
                    console.log(`   📈 Status: ${statusStr}, Company: ${companyId}`);
                } catch (e) {
                    console.log("   ⚠️  Could not parse order data");
                }

            } else if (dataSize === 82) {
                console.log("   💳 Type: SPL Token Mint");

            } else if (dataSize === 165) {
                console.log("   🏦 Type: SPL Token Account");

            } else {
                console.log(`   ❓ Type: Unknown (${dataSize} bytes)`);
                otherCount++;
            }

            // Show first 32 bytes of data in hex for debugging
            const dataPreview = accountData.slice(0, Math.min(32, dataSize)).toString('hex');
            console.log(`   🔍 Data preview: ${dataPreview}...`);

            // Explorer link
            console.log(`   🌐 Explorer: https://explorer.solana.com/address/${address}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`);

            console.log("");
        }

        console.log("=== 📊 Summary ===");
        console.log(`🏢 Platform Accounts: 1`);
        console.log(`🏪 Company Accounts: ${companyCount}`);
        console.log(`💰 Token Offering Accounts: ${offeringCount}`);
        console.log(`👤 Portfolio Accounts: ${portfolioCount}`);
        console.log(`📋 Order Accounts: ${orderCount}`);
        console.log(`❓ Other Accounts: ${otherCount}`);
        console.log(`📊 Total Accounts: ${accounts.length}`);

    } catch (error) {
        console.error("❌ Error scanning accounts:", error.message);
        console.log("\n⚠️  Make sure your local validator is running on port 8899!");
    }
}

findPortfoliosAndOrders().catch(console.error);