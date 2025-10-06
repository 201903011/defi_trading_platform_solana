const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');

async function viewOrderbook() {
    try {
        console.log('🏪 DeFi Trading Platform - Orderbook Viewer');
        console.log('='.repeat(60));

        // Setup provider and program
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

        // Fetch platform data
        const platformData = await program.account.platform.fetch(platformPda);
        console.log('\\n📊 PLATFORM STATISTICS:');
        console.log(`Total Companies: ${platformData.totalCompanies}`);
        console.log(`Total Trades: ${platformData.totalTrades}`);
        console.log(`Total Offerings: ${platformData.totalOfferings}`);
        console.log(`Platform Fee: ${platformData.platformFee}%`);
        console.log(`Platform Paused: ${platformData.isPaused}`);

        // Scan for all program accounts
        console.log('\\n🔍 Scanning for orderbook and sell order accounts...');
        const accounts = await provider.connection.getProgramAccounts(program.programId);

        let companies = [];
        let orderbooks = [];
        let sellOrders = [];
        let portfolios = [];

        for (const account of accounts) {
            try {
                // Try to decode as different account types

                // Company accounts
                try {
                    const company = program.coder.accounts.decode('company', account.account.data);
                    companies.push({
                        address: account.pubkey.toString(),
                        name: company.name,
                        symbol: company.symbol,
                        totalSupply: company.totalSupply.toString(),
                        tokenMint: company.tokenMint.toString()
                    });
                    continue;
                } catch (e) { }

                // Orderbook accounts
                try {
                    const orderbook = program.coder.accounts.decode('orderbook', account.account.data);
                    orderbooks.push({
                        address: account.pubkey.toString(),
                        company: orderbook.company.toString(),
                        totalOrders: orderbook.totalOrders.toString(),
                        nextOrderId: orderbook.nextOrderId.toString()
                    });
                    continue;
                } catch (e) { }

                // Sell order accounts
                try {
                    const sellOrder = program.coder.accounts.decode('sellOrder', account.account.data);
                    sellOrders.push({
                        address: account.pubkey.toString(),
                        orderId: sellOrder.orderId.toString(),
                        seller: sellOrder.seller.toString(),
                        company: sellOrder.company.toString(),
                        quantity: sellOrder.quantity.toString(),
                        pricePerShare: sellOrder.pricePerShare.toString(),
                        isActive: sellOrder.isActive,
                        createdAt: sellOrder.createdAt.toString()
                    });
                    continue;
                } catch (e) { }

                // Portfolio accounts
                try {
                    const portfolio = program.coder.accounts.decode('portfolio', account.account.data);
                    portfolios.push({
                        address: account.pubkey.toString(),
                        user: portfolio.user.toString(),
                        tokenBalance: portfolio.tokenBalance.toString(),
                        totalInvested: portfolio.totalInvested.toString(),
                        lastUpdated: portfolio.lastUpdated.toString()
                    });
                    continue;
                } catch (e) { }

            } catch (error) {
                // Skip accounts that can't be decoded
            }
        }

        // Display results
        console.log('\\n🏢 COMPANIES FOUND:', companies.length);
        companies.forEach((company, index) => {
            console.log(`\\n  Company ${index + 1}:`);
            console.log(`    Address: ${company.address}`);
            console.log(`    Name: "${company.name}"`);
            console.log(`    Symbol: ${company.symbol}`);
            console.log(`    Total Supply: ${company.totalSupply} tokens`);
            console.log(`    Token Mint: ${company.tokenMint}`);

            // Find orderbook for this company
            const companyOrderbook = orderbooks.find(ob => ob.company === company.address);
            if (companyOrderbook) {
                console.log(`    📋 Orderbook: ${companyOrderbook.address}`);
                console.log(`    📊 Total Orders: ${companyOrderbook.totalOrders}`);
                console.log(`    🆔 Next Order ID: ${companyOrderbook.nextOrderId}`);

                // Find sell orders for this company
                const companySellOrders = sellOrders.filter(order => order.company === company.address);
                if (companySellOrders.length > 0) {
                    console.log(`    💰 Active Sell Orders: ${companySellOrders.length}`);
                    companySellOrders.forEach((order, orderIndex) => {
                        const priceInSol = parseFloat(order.pricePerShare) / 1000000;
                        const totalValue = (parseFloat(order.quantity) * priceInSol);
                        console.log(`\\n      Order ${orderIndex + 1}:`);
                        console.log(`        Order ID: ${order.orderId}`);
                        console.log(`        Seller: ${order.seller}`);
                        console.log(`        Quantity: ${order.quantity} shares`);
                        console.log(`        Price: ${priceInSol.toFixed(6)} SOL per share`);
                        console.log(`        Total Value: ${totalValue.toFixed(6)} SOL`);
                        console.log(`        Active: ${order.isActive}`);
                        console.log(`        Created: ${new Date(parseInt(order.createdAt) * 1000).toLocaleString()}`);
                    });
                } else {
                    console.log(`    💰 Active Sell Orders: 0`);
                }
            } else {
                console.log(`    📋 Orderbook: Not found (not initialized)`);
            }
        });

        if (companies.length === 0) {
            console.log('\\n❌ No companies found. Register a company first.');
        }

        console.log('\\n👥 USER PORTFOLIOS FOUND:', portfolios.length);
        portfolios.forEach((portfolio, index) => {
            console.log(`\\n  Portfolio ${index + 1}:`);
            console.log(`    User: ${portfolio.user}`);
            console.log(`    Token Balance: ${portfolio.tokenBalance} tokens`);
            console.log(`    Total Invested: ${portfolio.totalInvested} lamports`);
            console.log(`    Last Updated: ${new Date(parseInt(portfolio.lastUpdated) * 1000).toLocaleString()}`);
        });

        // Summary
        console.log('\\n📋 ORDERBOOK SUMMARY:');
        console.log(`📊 Total Companies: ${companies.length}`);
        console.log(`📋 Total Orderbooks: ${orderbooks.length}`);
        console.log(`💰 Total Active Sell Orders: ${sellOrders.filter(o => o.isActive).length}`);
        console.log(`👥 Total User Portfolios: ${portfolios.length}`);

        if (sellOrders.length > 0) {
            const activeSellOrders = sellOrders.filter(o => o.isActive);
            const totalVolume = activeSellOrders.reduce((sum, order) => {
                return sum + (parseFloat(order.quantity) * parseFloat(order.pricePerShare) / 1000000);
            }, 0);
            console.log(`💹 Total Order Book Value: ${totalVolume.toFixed(6)} SOL`);

            if (activeSellOrders.length > 0) {
                const prices = activeSellOrders.map(o => parseFloat(o.pricePerShare) / 1000000);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                console.log(`💲 Price Range: ${minPrice.toFixed(6)} - ${maxPrice.toFixed(6)} SOL per share`);
            }
        }

        console.log('\\n💡 HOW TO USE THE ORDERBOOK:');
        console.log('1. Companies must be registered first');
        console.log('2. Users buy tokens through token offerings');
        console.log('3. Users can then place sell orders for their tokens');
        console.log('4. Other users can buy from the orderbook');
        console.log('\\n💡 Run full tests to see orderbook in action:');
        console.log('   anchor test --skip-local-validator');

    } catch (error) {
        console.error('❌ Error viewing orderbook:', error);
    }
}

if (require.main === module) {
    viewOrderbook().catch(console.error);
}

module.exports = { viewOrderbook };