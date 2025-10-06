const { Connection, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Connection to local validator
const connection = new Connection('http://localhost:8899', 'confirmed');

// Load the IDL
const idlPath = path.join(__dirname, '../target/idl/defi_trading_platform.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// Program ID
const programId = new PublicKey('FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z');

// Create a dummy wallet (we're just reading data)
const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: () => Promise.reject(),
    signAllTransactions: () => Promise.reject(),
};

const provider = new AnchorProvider(connection, dummyWallet, {});
const program = new Program(idl, programId, provider);

async function viewOrderbook() {
    try {
        console.log('🔍 Scanning for orderbook accounts...\n');

        // Get all accounts owned by our program
        const accounts = await connection.getProgramAccounts(programId);

        console.log(`Found ${accounts.length} total program accounts\n`);

        let orderbookFound = false;
        let sellOrdersFound = false;

        for (const account of accounts) {
            try {
                const accountInfo = account.account;
                const data = accountInfo.data;

                // Try to decode as different account types

                // Check if it's an orderbook account (look for discriminator)
                if (data.length >= 8) {
                    const discriminator = data.slice(0, 8);

                    // Try to decode as orderbook
                    try {
                        const decoded = program.coder.accounts.decode('orderbook', data);
                        console.log('📋 ORDERBOOK FOUND!');
                        console.log(`Address: ${account.pubkey.toString()}`);
                        console.log(`Company: ${decoded.company.toString()}`);
                        console.log(`Total Active Orders: ${decoded.totalOrders}`);
                        console.log(`Next Order ID: ${decoded.nextOrderId}`);
                        console.log('─'.repeat(50));
                        orderbookFound = true;
                        continue;
                    } catch (e) {
                        // Not an orderbook
                    }

                    // Try to decode as sell order
                    try {
                        const decoded = program.coder.accounts.decode('sellOrder', data);
                        console.log('💰 SELL ORDER FOUND!');
                        console.log(`Address: ${account.pubkey.toString()}`);
                        console.log(`Order ID: ${decoded.orderId}`);
                        console.log(`Seller: ${decoded.seller.toString()}`);
                        console.log(`Company: ${decoded.company.toString()}`);
                        console.log(`Quantity: ${decoded.quantity} shares`);
                        console.log(`Price per Share: ${decoded.pricePerShare / 1000000} SOL`);
                        console.log(`Total Value: ${(decoded.quantity * decoded.pricePerShare) / 1000000} SOL`);
                        console.log(`Is Active: ${decoded.isActive}`);
                        console.log(`Created At: ${new Date(decoded.createdAt * 1000).toLocaleString()}`);
                        console.log('─'.repeat(50));
                        sellOrdersFound = true;
                        continue;
                    } catch (e) {
                        // Not a sell order
                    }
                }
            } catch (error) {
                // Skip accounts that can't be decoded
            }
        }

        if (!orderbookFound && !sellOrdersFound) {
            console.log('❌ No orderbook or sell orders found');
            console.log('This could mean:');
            console.log('1. No sell orders have been placed yet');
            console.log('2. The orderbook hasn\'t been initialized');
            console.log('3. Orders may have been filled or cancelled');

            console.log('\n📝 To create sell orders, users need to:');
            console.log('1. Have tokens in their portfolio');
            console.log('2. Call the "place_sell_order" instruction');
            console.log('3. Specify quantity and price per share');
        }

        if (orderbookFound && !sellOrdersFound) {
            console.log('✅ Orderbook exists but no active sell orders found');
            console.log('Users can place sell orders if they own shares');
        }

    } catch (error) {
        console.error('Error viewing orderbook:', error);
    }
}

// Additional function to get orderbook summary
async function getOrderbookSummary() {
    try {
        console.log('\n📊 ORDERBOOK SUMMARY');
        console.log('='.repeat(50));

        // Get all accounts and categorize them
        const accounts = await connection.getProgramAccounts(programId);

        let orderbookCount = 0;
        let sellOrderCount = 0;
        let activeOrderCount = 0;
        let totalVolume = 0;
        let priceRange = { min: Infinity, max: 0 };

        for (const account of accounts) {
            try {
                const data = account.account.data;

                if (data.length >= 8) {
                    try {
                        const orderbook = program.coder.accounts.decode('orderbook', data);
                        orderbookCount++;
                    } catch (e) {
                        try {
                            const sellOrder = program.coder.accounts.decode('sellOrder', data);
                            sellOrderCount++;

                            if (sellOrder.isActive) {
                                activeOrderCount++;
                                const priceInSol = sellOrder.pricePerShare / 1000000;
                                totalVolume += (sellOrder.quantity * priceInSol);
                                priceRange.min = Math.min(priceRange.min, priceInSol);
                                priceRange.max = Math.max(priceRange.max, priceInSol);
                            }
                        } catch (e) {
                            // Not a sell order
                        }
                    }
                }
            } catch (error) {
                // Skip problematic accounts
            }
        }

        console.log(`📋 Orderbooks: ${orderbookCount}`);
        console.log(`📝 Total Sell Orders: ${sellOrderCount}`);
        console.log(`✅ Active Orders: ${activeOrderCount}`);
        console.log(`💰 Total Order Value: ${totalVolume.toFixed(4)} SOL`);

        if (activeOrderCount > 0) {
            console.log(`💹 Price Range: ${priceRange.min.toFixed(4)} - ${priceRange.max.toFixed(4)} SOL per share`);
        } else {
            console.log(`💹 Price Range: No active orders`);
        }

    } catch (error) {
        console.error('Error getting orderbook summary:', error);
    }
}

// Main execution
async function main() {
    console.log('🏪 DeFi Trading Platform - Orderbook Viewer');
    console.log('='.repeat(60));

    await viewOrderbook();
    await getOrderbookSummary();

    console.log('\n💡 TIP: To place a sell order, use the test script:');
    console.log('   npm test -- --grep "place sell order"');

    console.log('\n💡 TIP: To see detailed account info use:');
    console.log('   solana account <ACCOUNT_ADDRESS> --output json');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { viewOrderbook, getOrderbookSummary };