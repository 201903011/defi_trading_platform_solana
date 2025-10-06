const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

// Connection to local validator
const connection = new Connection('http://localhost:8899', 'confirmed');
const programId = new PublicKey('FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z');

// Account discriminators (first 8 bytes of account data)
const DISCRIMINATORS = {
    'orderbook': [0xb1, 0x7e, 0x9f, 0x3b, 0x79, 0x40, 0x28, 0x4a], // This is an example, actual values may differ
    'sellOrder': [0x34, 0x12, 0x90, 0x78, 0x56, 0x34, 0x12, 0x90], // This is an example, actual values may differ
};

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function readU64(buffer, offset) {
    const low = buffer.readUInt32LE(offset);
    const high = buffer.readUInt32LE(offset + 4);
    return low + (high * 0x100000000);
}

function readPublicKey(buffer, offset) {
    return new PublicKey(buffer.slice(offset, offset + 32));
}

async function scanForOrderbookAccounts() {
    try {
        console.log('🔍 Scanning for orderbook and sell order accounts...\n');

        // Get all accounts owned by our program
        const accounts = await connection.getProgramAccounts(programId);

        console.log(`Found ${accounts.length} total program accounts\n`);

        let orderbookCount = 0;
        let sellOrderCount = 0;
        let unknownAccounts = [];

        for (const account of accounts) {
            const data = account.account.data;
            const address = account.pubkey.toString();

            if (data.length < 8) {
                console.log(`⚠️  Account ${address} too small (${data.length} bytes)`);
                continue;
            }

            const discriminator = bytesToHex(data.slice(0, 8));

            console.log(`📋 Account: ${address}`);
            console.log(`   Size: ${data.length} bytes`);
            console.log(`   Discriminator: ${discriminator}`);

            // Try to parse based on size and structure
            if (data.length >= 100) { // Likely a complex account
                try {
                    // Try to read as orderbook-like structure
                    let offset = 8; // Skip discriminator

                    if (data.length >= 72) { // Minimum size for orderbook
                        const company = readPublicKey(data, offset);
                        offset += 32;

                        if (offset + 16 <= data.length) {
                            const totalOrders = readU64(data, offset);
                            offset += 8;
                            const nextOrderId = readU64(data, offset);

                            console.log(`   🏢 Company: ${company.toString()}`);
                            console.log(`   📊 Total Orders: ${totalOrders}`);
                            console.log(`   🆔 Next Order ID: ${nextOrderId}`);
                            console.log(`   📋 Type: Likely ORDERBOOK`);
                            orderbookCount++;
                        }
                    }
                } catch (e) {
                    // Try to parse as sell order
                    try {
                        let offset = 8; // Skip discriminator

                        if (data.length >= 120) { // Minimum size for sell order
                            const orderId = readU64(data, offset);
                            offset += 8;
                            const seller = readPublicKey(data, offset);
                            offset += 32;
                            const company = readPublicKey(data, offset);
                            offset += 32;
                            const quantity = readU64(data, offset);
                            offset += 8;
                            const pricePerShare = readU64(data, offset);
                            offset += 8;
                            const isActive = data[offset] === 1;
                            offset += 1;

                            console.log(`   🆔 Order ID: ${orderId}`);
                            console.log(`   👤 Seller: ${seller.toString()}`);
                            console.log(`   🏢 Company: ${company.toString()}`);
                            console.log(`   📦 Quantity: ${quantity} shares`);
                            console.log(`   💰 Price: ${pricePerShare / 1000000} SOL per share`);
                            console.log(`   ✅ Active: ${isActive}`);
                            console.log(`   📝 Type: Likely SELL ORDER`);
                            sellOrderCount++;
                        }
                    } catch (e2) {
                        unknownAccounts.push({ address, size: data.length, discriminator });
                        console.log(`   ❓ Type: UNKNOWN (parsing failed)`);
                    }
                }
            } else {
                unknownAccounts.push({ address, size: data.length, discriminator });
                console.log(`   ❓ Type: UNKNOWN (too small for orderbook/order)`);
            }

            console.log('─'.repeat(70));
        }

        console.log('\n📊 SUMMARY:');
        console.log(`📋 Orderbooks found: ${orderbookCount}`);
        console.log(`💰 Sell orders found: ${sellOrderCount}`);
        console.log(`❓ Unknown accounts: ${unknownAccounts.length}`);

        if (unknownAccounts.length > 0) {
            console.log('\n❓ Unknown account details:');
            unknownAccounts.forEach(acc => {
                console.log(`   ${acc.address} (${acc.size} bytes, disc: ${acc.discriminator})`);
            });
        }

        if (orderbookCount === 0 && sellOrderCount === 0) {
            console.log('\n💡 No orderbook or sell orders detected.');
            console.log('To create sell orders:');
            console.log('1. Ensure you have tokens in a portfolio');
            console.log('2. Run the test that places sell orders');
            console.log('3. Check that the orderbook has been initialized');
        }

    } catch (error) {
        console.error('❌ Error scanning accounts:', error);
    }
}

// Alternative: Use solana CLI to examine specific accounts
async function checkAccountsWithCLI() {
    console.log('\n🔧 You can also examine accounts using Solana CLI:');
    console.log('1. List all program accounts:');
    console.log(`   solana program show ${programId.toString()}`);
    console.log('\n2. Check specific account details:');
    console.log('   solana account <ACCOUNT_ADDRESS> --output json');
    console.log('\n3. Get all program accounts (might be large):');
    console.log(`   solana program dump ${programId.toString()} /tmp/program_accounts.json`);
}

async function main() {
    console.log('🏪 DeFi Trading Platform - Orderbook Scanner');
    console.log('='.repeat(70));

    await scanForOrderbookAccounts();
    await checkAccountsWithCLI();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { scanForOrderbookAccounts };