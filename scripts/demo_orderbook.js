const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram, Keypair } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');

async function demonstrateOrderbook() {
    try {
        console.log('🚀 DeFi Trading Platform - Orderbook Demonstration');
        console.log('='.repeat(65));

        // Setup
        const provider = anchor.AnchorProvider.env();
        anchor.setProvider(provider);
        const program = anchor.workspace.DefiTradingPlatform;

        console.log('📡 Connected to:', provider.connection.rpcEndpoint);
        console.log('🏢 Program ID:', program.programId.toString());

        // Get platform PDA
        const [platformPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform")],
            program.programId
        );

        console.log('\\n📊 Current Platform State:');
        try {
            const platformData = await program.account.platform.fetch(platformPda);
            console.log(`Companies: ${platformData.totalCompanies}`);
            console.log(`Offerings: ${platformData.totalOfferings}`);
            console.log(`Trades: ${platformData.totalTrades}`);
        } catch (e) {
            console.log('❌ Platform not initialized');
            return;
        }

        // Find existing company
        console.log('\\n🔍 Looking for existing companies...');
        const accounts = await provider.connection.getProgramAccounts(program.programId);

        let company = null;
        for (const account of accounts) {
            try {
                const companyData = program.coder.accounts.decode('company', account.account.data);
                company = {
                    address: account.pubkey,
                    data: companyData
                };
                console.log(`✅ Found company: "${companyData.name}" (${companyData.symbol})`);
                console.log(`   Address: ${account.pubkey.toString()}`);
                console.log(`   Token Mint: ${companyData.tokenMint.toString()}`);
                break;
            } catch (e) {
                // Not a company account
            }
        }

        if (!company) {
            console.log('❌ No companies found. Run the tests first to create a company.');
            return;
        }

        // Check for orderbook
        console.log('\\n📋 Checking for orderbook...');
        const [orderbookPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("orderbook"), company.address.toBuffer()],
            program.programId
        );

        try {
            const orderbookData = await program.account.orderbook.fetch(orderbookPda);
            console.log('✅ Orderbook exists!');
            console.log(`   Address: ${orderbookPda.toString()}`);
            console.log(`   Total Orders: ${orderbookData.totalOrders.toString()}`);
            console.log(`   Next Order ID: ${orderbookData.nextOrderId.toString()}`);
        } catch (e) {
            console.log('❌ Orderbook not initialized yet');
            console.log(`   Expected address: ${orderbookPda.toString()}`);
            console.log('   💡 Will be created when first sell order is placed');
        }

        // Look for sell orders
        console.log('\\n💰 Scanning for sell orders...');
        let sellOrders = [];

        for (const account of accounts) {
            try {
                const sellOrder = program.coder.accounts.decode('sellOrder', account.account.data);
                if (sellOrder.company.equals(company.address)) {
                    sellOrders.push({
                        address: account.pubkey.toString(),
                        ...sellOrder
                    });
                }
            } catch (e) {
                // Not a sell order
            }
        }

        if (sellOrders.length > 0) {
            console.log(`✅ Found ${sellOrders.length} sell orders:`);
            sellOrders.forEach((order, index) => {
                const priceInSol = order.pricePerShare.toNumber() / 1000000000;
                const totalValue = order.quantity.toNumber() * priceInSol;

                console.log(`\\n   Order ${index + 1}:`);
                console.log(`   📍 Address: ${order.address}`);
                console.log(`   🆔 Order ID: ${order.orderId.toString()}`);
                console.log(`   👤 Seller: ${order.seller.toString()}`);
                console.log(`   📦 Quantity: ${order.quantity.toString()} shares`);
                console.log(`   💰 Price: ${priceInSol.toFixed(6)} SOL per share`);
                console.log(`   💹 Total Value: ${totalValue.toFixed(6)} SOL`);
                console.log(`   ✅ Active: ${order.isActive}`);
                console.log(`   📅 Created: ${new Date(order.createdAt.toNumber() * 1000).toLocaleString()}`);
            });

            // Calculate market statistics
            const activeOrders = sellOrders.filter(o => o.isActive);
            if (activeOrders.length > 0) {
                const prices = activeOrders.map(o => o.pricePerShare.toNumber() / 1000000000);
                const volumes = activeOrders.map(o => o.quantity.toNumber());
                const totalVolume = activeOrders.reduce((sum, o) => sum + (o.quantity.toNumber() * o.pricePerShare.toNumber() / 1000000000), 0);

                console.log('\\n📊 Market Statistics:');
                console.log(`   Active Orders: ${activeOrders.length}`);
                console.log(`   Total Shares for Sale: ${volumes.reduce((a, b) => a + b, 0)}`);
                console.log(`   Total Market Value: ${totalVolume.toFixed(6)} SOL`);
                console.log(`   Price Range: ${Math.min(...prices).toFixed(6)} - ${Math.max(...prices).toFixed(6)} SOL`);
                console.log(`   Average Price: ${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(6)} SOL`);
            }
        } else {
            console.log('📭 No sell orders found');
        }

        // Look for portfolios
        console.log('\\n👥 Scanning for user portfolios...');
        let portfolios = [];

        for (const account of accounts) {
            try {
                const portfolio = program.coder.accounts.decode('portfolio', account.account.data);
                portfolios.push({
                    address: account.pubkey.toString(),
                    ...portfolio
                });
            } catch (e) {
                // Not a portfolio
            }
        }

        if (portfolios.length > 0) {
            console.log(`✅ Found ${portfolios.length} user portfolios:`);
            portfolios.forEach((portfolio, index) => {
                console.log(`\\n   Portfolio ${index + 1}:`);
                console.log(`   📍 Address: ${portfolio.address}`);
                console.log(`   👤 User: ${portfolio.user.toString()}`);
                console.log(`   🪙 Token Balance: ${portfolio.tokenBalance ? portfolio.tokenBalance.toString() : 'undefined'} tokens`);
                console.log(`   💰 Total Invested: ${portfolio.totalInvested ? portfolio.totalInvested.toString() : 'undefined'} lamports`);
                console.log(`   📅 Last Updated: ${portfolio.lastUpdated ? new Date(portfolio.lastUpdated.toNumber() * 1000).toLocaleString() : 'undefined'}`);
            });
        } else {
            console.log('📭 No user portfolios found');
        }

        // Summary and next steps
        console.log('\\n📋 ORDERBOOK SUMMARY');
        console.log('='.repeat(65));
        console.log(`🏢 Companies: ${company ? 1 : 0}`);
        console.log(`📋 Orderbooks: ${sellOrders.length > 0 ? 1 : 0}`);
        console.log(`💰 Sell Orders: ${sellOrders.length}`);
        console.log(`👥 User Portfolios: ${portfolios.length}`);

        if (sellOrders.length === 0) {
            console.log('\\n💡 To create sell orders:');
            console.log('1. Users need to participate in token offerings to get tokens');
            console.log('2. Users create portfolios to track their holdings');
            console.log('3. Users place sell orders for tokens they own');
            console.log('4. Other users can then buy from these orders');

            console.log('\\n🚀 Try running the full test suite:');
            console.log('   anchor test --skip-local-validator');
        } else {
            console.log('\\n✅ Orderbook is active and ready for trading!');
            console.log('\\n💡 Users can now:');
            console.log('• Place additional sell orders');
            console.log('• Buy tokens from existing orders');
            console.log('• View real-time market data');
        }

    } catch (error) {
        console.error('❌ Error demonstrating orderbook:', error);
    }
}

if (require.main === module) {
    demonstrateOrderbook().catch(console.error);
}

module.exports = { demonstrateOrderbook };