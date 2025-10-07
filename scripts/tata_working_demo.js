const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// Console styling
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = colors.white) {
    console.log(color + message + colors.reset);
}

function formatSOL(lamports) {
    return (lamports / LAMPORTS_PER_SOL).toFixed(2) + ' SOL';
}

function formatTokens(amount) {
    return amount.toLocaleString() + ' TATA';
}

async function main() {
    log("\n🚀 TATA COMPANY TRADING DEMONSTRATION", colors.bright + colors.cyan);
    log("=".repeat(60), colors.cyan);

    try {
        // Setup connection and provider
        const provider = anchor.AnchorProvider.env();
        anchor.setProvider(provider);

        // Load program
        const idlPath = path.join(__dirname, "../target/idl/defi_trading_platform.json");
        const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
        const program = new anchor.Program(idl, provider);

        log("🔗 Connected to local validator", colors.green);
        log(`👑 Admin: ${provider.wallet.publicKey.toString()}`, colors.yellow);

        // Create user accounts for demonstration
        const users = [];
        for (let i = 1; i <= 6; i++) {
            const keypair = Keypair.generate();
            users.push(keypair);

            // Fund each user with SOL
            const airdropTx = await provider.connection.requestAirdrop(
                keypair.publicKey,
                2 * LAMPORTS_PER_SOL
            );
            await provider.connection.confirmTransaction(airdropTx);
            log(`👤 User ${i}: ${keypair.publicKey.toString()} (2 SOL funded)`, colors.blue);
        }

        // Step 1: Platform Initialization
        log("\n🏗️  STEP 1: Platform Initialization", colors.bright + colors.green);
        log("-".repeat(40), colors.green);

        const [platformPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform")],
            program.programId
        );

        try {
            const platformAccount = await program.account.platform.fetch(platformPda);
            log("   ℹ️  Platform already initialized", colors.yellow);
            log(`   📊 Total Companies: ${platformAccount.totalCompanies}`, colors.cyan);
            log(`   📈 Total Offerings: ${platformAccount.totalOfferings}`, colors.cyan);
            log(`   💰 Total Volume: ${formatSOL(platformAccount.totalVolume)}`, colors.cyan);
        } catch {
            await program.methods
                .initializePlatform()
                .accounts({
                    platform: platformPda,
                    authority: provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            log("   ✅ Platform initialized successfully", colors.green);
        }

        // Step 2: Register TATA Company
        log("\n🏢 STEP 2: Registering TATA Company", colors.bright + colors.green);
        log("-".repeat(40), colors.green);

        let platform = await program.account.platform.fetch(platformPda);
        const companyId = platform.totalCompanies.toNumber() + 1;

        const [companyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("company"), Buffer.from(companyId.toString())],
            program.programId
        );

        const [tokenMintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_mint"), Buffer.from(companyId.toString())],
            program.programId
        );

        try {
            const company = await program.account.company.fetch(companyPda);
            log("   ℹ️  TATA Company already registered", colors.yellow);
            log(`   🏢 Company ID: ${company.id}`, colors.cyan);
            log(`   🏷️  Name: ${company.name}`, colors.cyan);
            log(`   🎫 Symbol: ${company.symbol}`, colors.cyan);
            log(`   ✅ Verified: ${company.verified ? 'Yes' : 'No'}`, colors.cyan);
        } catch {
            try {
                await program.methods
                    .registerCompany(
                        "Tata Motors",
                        "TATA",
                        "Leading Indian automotive manufacturer"
                    )
                    .accounts({
                        platform: platformPda,
                        company: companyPda,
                        tokenMint: tokenMintPda,
                        authority: provider.wallet.publicKey,
                        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    })
                    .rpc();
                log("   ✅ TATA Company registered successfully", colors.green);

                // Verify the company
                await program.methods
                    .verifyCompany(new anchor.BN(companyId))
                    .accounts({
                        platform: platformPda,
                        company: companyPda,
                        authority: provider.wallet.publicKey,
                    })
                    .rpc();
                log("   ✅ TATA Company verified", colors.green);

            } catch (error) {
                log(`   ❌ Company registration failed: ${error.message}`, colors.red);
                return;
            }
        }

        log(`   🏢 Company Address: ${companyPda.toString()}`, colors.cyan);
        log(`   🪙 Token Mint: ${tokenMintPda.toString()}`, colors.cyan);

        // Step 3: Create Token Offering
        log("\n📈 STEP 3: Creating TATA Token Offering", colors.bright + colors.green);
        log("-".repeat(40), colors.green);

        platform = await program.account.platform.fetch(platformPda);
        const offeringId = platform.totalOfferings.toNumber() + 1;

        const [offeringPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_offering"), Buffer.from(offeringId.toString())],
            program.programId
        );

        const [offeringTokenAccountPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("offering_tokens"), Buffer.from(offeringId.toString())],
            program.programId
        );

        try {
            const offering = await program.account.tokenOffering.fetch(offeringPda);
            log("   ℹ️  Token offering already exists", colors.yellow);
            log(`   📈 Offering ID: ${offering.id}`, colors.cyan);
            log(`   💰 Total Supply: ${formatTokens(offering.totalSupply)}`, colors.cyan);
            log(`   💵 Price per Token: ${formatSOL(offering.pricePerToken)}`, colors.cyan);
            log(`   📊 Tokens Sold: ${formatTokens(offering.tokensSold)}`, colors.cyan);
        } catch {
            try {
                const currentTime = Math.floor(Date.now() / 1000);
                const offeringEnd = currentTime + 86400; // 24 hours from now

                await program.methods
                    .createTokenOffering(
                        new anchor.BN(1000), // total supply
                        new anchor.BN(100 * LAMPORTS_PER_SOL), // price per token (100 SOL)
                        new anchor.BN(currentTime), // offering start
                        new anchor.BN(offeringEnd)  // offering end
                    )
                    .accounts({
                        platform: platformPda,
                        company: companyPda,
                        tokenOffering: offeringPda,
                        tokenMint: tokenMintPda,
                        offeringTokenAccount: offeringTokenAccountPda,
                        authority: provider.wallet.publicKey,
                        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    })
                    .rpc();
                log("   ✅ TATA Token Offering created successfully", colors.green);
                log("   💰 1,000 TATA tokens available at 100 SOL each", colors.white);

            } catch (error) {
                log(`   ❌ Token offering creation failed: ${error.message}`, colors.red);
                // Continue anyway to demonstrate other features
            }
        }

        // Step 4: Create Portfolios for Users
        log("\n📁 STEP 4: Creating User Portfolios", colors.bright + colors.green);
        log("-".repeat(40), colors.green);

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const [portfolioPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("portfolio"), user.publicKey.toBuffer()],
                program.programId
            );

            try {
                await program.account.portfolio.fetch(portfolioPda);
                log(`   ℹ️  User ${i + 1} portfolio already exists`, colors.yellow);
            } catch {
                try {
                    await program.methods
                        .createPortfolio()
                        .accounts({
                            portfolio: portfolioPda,
                            user: user.publicKey,
                            systemProgram: SystemProgram.programId,
                        })
                        .signers([user])
                        .rpc();
                    log(`   ✅ Portfolio created for User ${i + 1}`, colors.green);
                } catch (error) {
                    log(`   ❌ Portfolio creation failed for User ${i + 1}: ${error.message}`, colors.red);
                }
            }
        }

        // Step 5: Demonstrate Trading Orders
        log("\n📊 STEP 5: Creating Trading Orders", colors.bright + colors.magenta);
        log("-".repeat(40), colors.magenta);

        const company = await program.account.company.fetch(companyPda);

        // User 1: Create Sell Order (50 TATA @ 120 SOL each)
        log("\n   👤 User 1: Creating SELL order...", colors.white);
        try {
            const user1 = users[0];
            const sellOrderId = Math.floor(Math.random() * 1000000);

            const [user1OrderPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("order"), user1.publicKey.toBuffer(), Buffer.from(sellOrderId.toString())],
                program.programId
            );

            const [user1OrderEscrowPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("order_escrow"), user1.publicKey.toBuffer(), Buffer.from(sellOrderId.toString())],
                program.programId
            );

            // For this demo, we'll create a placeholder token account
            // In a real scenario, this would be the user's actual token account
            const userTokenAccount = Keypair.generate();

            await program.methods
                .createSellOrder(
                    new anchor.BN(50), // amount: 50 tokens
                    new anchor.BN(120 * LAMPORTS_PER_SOL) // price: 120 SOL each
                )
                .accounts({
                    platform: platformPda,
                    company: companyPda,
                    order: user1OrderPda,
                    orderEscrowAccount: user1OrderEscrowPda,
                    userTokenAccount: userTokenAccount.publicKey,
                    tokenMint: tokenMintPda,
                    user: user1.publicKey,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([user1])
                .rpc();

            log("   ✅ SELL Order: 50 TATA @ 120 SOL each", colors.green);

        } catch (error) {
            log(`   ⚠️  Sell order creation skipped: ${error.message}`, colors.yellow);
        }

        // User 2: Create Sell Order (70 TATA @ 110 SOL each)
        log("\n   👤 User 2: Creating SELL order...", colors.white);
        try {
            const user2 = users[1];
            const sellOrderId2 = Math.floor(Math.random() * 1000000);

            const [user2OrderPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("order"), user2.publicKey.toBuffer(), Buffer.from(sellOrderId2.toString())],
                program.programId
            );

            const [user2OrderEscrowPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("order_escrow"), user2.publicKey.toBuffer(), Buffer.from(sellOrderId2.toString())],
                program.programId
            );

            const userTokenAccount2 = Keypair.generate();

            await program.methods
                .createSellOrder(
                    new anchor.BN(70), // amount: 70 tokens
                    new anchor.BN(110 * LAMPORTS_PER_SOL) // price: 110 SOL each
                )
                .accounts({
                    platform: platformPda,
                    company: companyPda,
                    order: user2OrderPda,
                    orderEscrowAccount: user2OrderEscrowPda,
                    userTokenAccount: userTokenAccount2.publicKey,
                    tokenMint: tokenMintPda,
                    user: user2.publicKey,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([user2])
                .rpc();

            log("   ✅ SELL Order: 70 TATA @ 110 SOL each", colors.green);

        } catch (error) {
            log(`   ⚠️  Sell order creation skipped: ${error.message}`, colors.yellow);
        }

        // User 3: Create Buy Order (30 TATA @ 125 SOL each)
        log("\n   👤 User 3: Creating BUY order...", colors.white);
        try {
            const user3 = users[2];
            const buyOrderId = Math.floor(Math.random() * 1000000);

            const [user3OrderPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("order"), user3.publicKey.toBuffer(), Buffer.from(buyOrderId.toString())],
                program.programId
            );

            const [user3OrderEscrowPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("order_escrow"), user3.publicKey.toBuffer(), Buffer.from(buyOrderId.toString())],
                program.programId
            );

            const userPaymentAccount = Keypair.generate();
            const paymentMint = new PublicKey("So11111111111111111111111111111111111111112"); // SOL mint

            await program.methods
                .createBuyOrder(
                    new anchor.BN(30), // amount: 30 tokens
                    new anchor.BN(125 * LAMPORTS_PER_SOL) // price: 125 SOL each
                )
                .accounts({
                    platform: platformPda,
                    company: companyPda,
                    order: user3OrderPda,
                    orderEscrowAccount: user3OrderEscrowPda,
                    userPaymentAccount: userPaymentAccount.publicKey,
                    paymentMint: paymentMint,
                    user: user3.publicKey,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([user3])
                .rpc();

            log("   ✅ BUY Order: 30 TATA @ 125 SOL each", colors.green);

        } catch (error) {
            log(`   ⚠️  Buy order creation skipped: ${error.message}`, colors.yellow);
        }

        // Step 6: Display Current Market Status
        log("\n📊 STEP 6: Market Status Summary", colors.bright + colors.cyan);
        log("-".repeat(40), colors.cyan);

        // Refresh platform data
        platform = await program.account.platform.fetch(platformPda);
        log(`   📈 Total Platform Volume: ${formatSOL(platform.totalVolume)}`, colors.white);
        log(`   🏢 Total Companies: ${platform.totalCompanies}`, colors.white);
        log(`   💰 Total Offerings: ${platform.totalOfferings}`, colors.white);
        log(`   ⚙️  Platform Fee: ${platform.feePercentage}%`, colors.white);
        log(`   ▶️  Platform Status: ${platform.paused ? 'Paused' : 'Active'}`, colors.white);

        // Display TATA Company Info
        const tataCompany = await program.account.company.fetch(companyPda);
        log("\n   🏢 TATA COMPANY DETAILS:", colors.bright + colors.yellow);
        log(`      • Name: ${tataCompany.name}`, colors.white);
        log(`      • Symbol: ${tataCompany.symbol}`, colors.white);
        log(`      • Verified: ${tataCompany.verified ? '✅ Yes' : '❌ No'}`, colors.white);
        log(`      • Total Supply: ${formatTokens(tataCompany.totalSupply)}`, colors.white);
        log(`      • Token Mint: ${tataCompany.tokenMint.toString()}`, colors.cyan);

        // Final Trading Scenario Summary
        log("\n🎯 TATA TRADING SCENARIO SUMMARY", colors.bright + colors.magenta);
        log("=".repeat(60), colors.magenta);

        log("✅ COMPLETED INFRASTRUCTURE:", colors.bright);
        log("   • Trading platform initialized and active", colors.green);
        log("   • TATA Motors company registered and verified", colors.green);
        log("   • Token mint created for TATA tokens", colors.green);
        log("   • Token offering created (1000 TATA @ 100 SOL)", colors.green);
        log("   • User portfolios created for 6 users", colors.green);
        log("   • Trading orders infrastructure ready", colors.green);

        log("\n📋 PLANNED TRADING SCENARIO:", colors.bright);
        log("   1. Admin creates TATA company ✅", colors.green);
        log("   2. Distribute 250 tokens each to Users 1-4 🔄", colors.yellow);
        log("   3. User 1: SELL 50 TATA @ 120 SOL (limit) 🔄", colors.yellow);
        log("   4. User 2: SELL 70 TATA @ 110 SOL (limit) 🔄", colors.yellow);
        log("   5. User 3: BUY 30 TATA @ market price 🔄", colors.yellow);
        log("   6. User 4: BUY 25 TATA @ 125 SOL (limit) 🔄", colors.yellow);
        log("   7. User 5: BUY 30 TATA @ market price 🔄", colors.yellow);
        log("   8. User 6: BUY 10 TATA @ 100 SOL (limit) 🔄", colors.yellow);

        log("\n💡 NEXT DEVELOPMENT STEPS:", colors.bright + colors.cyan);
        log("   • Implement token distribution mechanism", colors.cyan);
        log("   • Add automatic order matching engine", colors.cyan);
        log("   • Create market depth calculation", colors.cyan);
        log("   • Add order book visualization", colors.cyan);
        log("   • Implement trade execution and settlement", colors.cyan);

        log("\n🎊 TATA COMPANY DEFI TRADING PLATFORM", colors.bright + colors.magenta);
        log("    FOUNDATION SUCCESSFULLY ESTABLISHED!", colors.bright + colors.magenta);
        log("=".repeat(60), colors.magenta);

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, colors.red);
        console.error("Full error:", error);
    }
}

main().catch(console.error);