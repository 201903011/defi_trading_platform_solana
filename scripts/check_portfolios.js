const { PublicKey, Connection } = require("@solana/web3.js");

// Program ID from our deployment
const programId = new PublicKey("FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z");
const connection = new Connection("http://localhost:8899", "confirmed");

async function getPortfoliosAndOrders() {
    console.log("=== 📊 DeFi Trading Platform - Portfolios & Orders ===\n");

    // Test user addresses (from your test suite)
    const users = [
        {
            name: "Platform Authority / User1",
            pubkey: new PublicKey("DcjakLshDNnnRdDGRwHcR4BaENKiDXFCy2Pi2vHJB5xU")
        },
        // You can add more user addresses here if you have them
    ];

    for (const user of users) {
        console.log(`👤 ${user.name}: ${user.pubkey.toString()}`);

        // Calculate portfolio PDA for this user
        const [portfolioPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("portfolio"), user.pubkey.toBuffer()],
            programId
        );

        console.log(`📁 Portfolio PDA: ${portfolioPda.toString()}`);

        // Check if portfolio account exists
        try {
            const portfolioAccountInfo = await connection.getAccountInfo(portfolioPda);
            if (portfolioAccountInfo) {
                console.log(`✅ Portfolio exists - Balance: ${portfolioAccountInfo.lamports / 1e9} SOL`);
                console.log(`📄 Data size: ${portfolioAccountInfo.data.length} bytes`);

                // Display raw data (first 100 bytes for readability)
                const dataHex = portfolioAccountInfo.data.toString('hex');
                console.log(`📋 Portfolio data (hex): ${dataHex.substring(0, 100)}...`);
            } else {
                console.log("❌ Portfolio account does not exist");
            }
        } catch (error) {
            console.log("❌ Error fetching portfolio:", error.message);
        }

        // Look for orders for this user (we'll check multiple order IDs)
        console.log("\n🔍 Checking for orders...");
        for (let orderId = 1; orderId <= 5; orderId++) {
            const orderIdBuffer = Buffer.allocUnsafe(8);
            orderIdBuffer.writeUInt32LE(orderId, 0);
            orderIdBuffer.writeUInt32LE(0, 4);

            const [orderPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("order"), user.pubkey.toBuffer(), orderIdBuffer],
                programId
            );

            try {
                const orderAccountInfo = await connection.getAccountInfo(orderPda);
                if (orderAccountInfo) {
                    console.log(`📋 Order #${orderId}: ${orderPda.toString()}`);
                    console.log(`   Balance: ${orderAccountInfo.lamports / 1e9} SOL`);
                    console.log(`   Data size: ${orderAccountInfo.data.length} bytes`);

                    // Display raw data (first 100 bytes)
                    const orderDataHex = orderAccountInfo.data.toString('hex');
                    console.log(`   Data (hex): ${orderDataHex.substring(0, 100)}...`);
                }
            } catch (error) {
                // Silently skip non-existent orders
            }
        }

        console.log("\n" + "=".repeat(60) + "\n");
    }

    // Get platform statistics
    console.log("📊 Platform Statistics:");
    const [platformPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform")],
        programId
    );

    try {
        const platformAccountInfo = await connection.getAccountInfo(platformPda);
        if (platformAccountInfo) {
            const platformData = platformAccountInfo.data;
            // Platform data structure: authority(32) + total_companies(8) + total_offerings(8) + total_trades(8) + platform_fee(2) + is_paused(1) + bump(1)

            // Read total companies (bytes 40-47)
            const totalCompanies = platformData.readBigUInt64LE(40);
            console.log(`🏢 Total Companies: ${totalCompanies}`);

            // Read total offerings (bytes 48-55)  
            const totalOfferings = platformData.readBigUInt64LE(48);
            console.log(`💰 Total Offerings: ${totalOfferings}`);

            // Read total trades (bytes 56-63)
            const totalTrades = platformData.readBigUInt64LE(56);
            console.log(`📈 Total Trades: ${totalTrades}`);

            // Read platform fee (bytes 64-65)
            const platformFee = platformData.readUInt16LE(64);
            console.log(`💳 Platform Fee: ${platformFee / 100}%`);
        }
    } catch (error) {
        console.log("❌ Error fetching platform stats:", error.message);
    }

    console.log("\n=== 🔗 Explorer Links ===");
    for (const user of users) {
        const [portfolioPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("portfolio"), user.pubkey.toBuffer()],
            programId
        );

        console.log(`${user.name} Portfolio:`);
        console.log(`https://explorer.solana.com/address/${portfolioPda.toString()}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`);
    }

    console.log("\n⚠️  Note: Make sure your local validator is running on port 8899!");
}

getPortfoliosAndOrders().catch(console.error);