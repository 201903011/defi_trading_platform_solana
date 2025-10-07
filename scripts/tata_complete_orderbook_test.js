const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } = require('@solana/spl-token');

// Load the workspace
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.DefiTradingPlatform;

// Test scenario: TATA company with complete orderbook functionality
async function runTataScenario() {
    console.log("\n🚀 Starting TATA Company DeFi Trading Platform Test Scenario");
    console.log("=" * 70);

    // Initialize accounts
    const admin = provider.wallet;
    const user1 = Keypair.generate();
    const user2 = Keypair.generate();
    const user3 = Keypair.generate();
    const user4 = Keypair.generate();
    const user5 = Keypair.generate();
    const user6 = Keypair.generate();

    // Fund all users with SOL
    console.log("\n💰 Funding user accounts with SOL...");
    for (const user of [user1, user2, user3, user4, user5, user6]) {
        const signature = await provider.connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL);
        await provider.connection.confirmTransaction(signature);
        console.log(`   ✅ Funded ${user.publicKey.toString().slice(0, 8)}... with 2 SOL`);
    }

    try {
        // Step 1: Initialize Platform
        console.log("\n🏗️  Step 1: Initializing Trading Platform...");
        const [platformPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform")],
            program.programId
        );

        try {
            await program.methods
                .initializePlatform()
                .accounts({
                    platform: platformPda,
                    authority: admin.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log("   ✅ Platform initialized successfully");
        } catch (error) {
            if (error.message.includes("already in use")) {
                console.log("   ℹ️  Platform already initialized");
            } else {
                throw error;
            }
        }

        // Step 2: Create TATA company with initial supply
        console.log("\n🏢 Step 2: Creating TATA Company...");

        const companyId = 1;
        const [companyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("company"), Buffer.from([companyId, 0, 0, 0, 0, 0, 0, 0])],
            program.programId
        );

        const [tokenMintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_mint"), Buffer.from([companyId, 0, 0, 0, 0, 0, 0, 0])],
            program.programId
        );

        const [orderbookPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("orderbook"), Buffer.from([companyId, 0, 0, 0, 0, 0, 0, 0])],
            program.programId
        );

        // Create admin token account
        const adminTokenAccount = await createAccount(
            provider.connection,
            admin.payer,
            tokenMintPda,
            admin.publicKey
        );

        await program.methods
            .adminCreateCompany(
                "Tata Motors",
                "TATA",
                "Leading automotive manufacturer in India",
                new anchor.BN(1000 * 1000000), // 1000 tokens with 6 decimals
                new anchor.BN(100 * 1000000)   // 100 SOL price with 6 decimals
            )
            .accounts({
                platform: platformPda,
                company: companyPda,
                tokenMint: tokenMintPda,
                orderbook: orderbookPda,
                adminTokenAccount: adminTokenAccount,
                admin: admin.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log("   ✅ TATA Company created successfully");
        console.log(`   📊 Company ID: ${companyId}`);
        console.log(`   🏢 Company Address: ${companyPda.toString()}`);
        console.log(`   🪙 Token Mint: ${tokenMintPda.toString()}`);
        console.log(`   📈 Orderbook: ${orderbookPda.toString()}`);
        console.log(`   💰 Initial Supply: 1000 TATA tokens`);
        console.log(`   💵 Initial Price: 100 SOL per token`);

        // Step 3: Distribute tokens to users 1-4 (250 each)
        console.log("\n📦 Step 3: Distributing TATA tokens to initial users...");

        const tokensPerUser = 250;
        for (let i = 0; i < 4; i++) {
            const user = [user1, user2, user3, user4][i];

            // Create user token account
            const userTokenAccount = await createAccount(
                provider.connection,
                admin.payer,
                tokenMintPda,
                user.publicKey
            );

            // Transfer tokens from admin to user
            const transferIx = await program.methods
                .transferToRecipient(
                    new anchor.BN(1), // distribution_id (placeholder)
                    new anchor.BN(tokensPerUser * 1000000) // amount with decimals
                )
                .accounts({
                    distribution: orderbookPda, // Using orderbook as placeholder for distribution
                    adminTokenAccount: adminTokenAccount,
                    recipientTokenAccount: userTokenAccount,
                    admin: admin.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();

            // For simplicity, let's use direct token transfer
            await mintTo(
                provider.connection,
                admin.payer,
                tokenMintPda,
                userTokenAccount,
                companyPda,
                tokensPerUser * 1000000,
                [admin.payer]
            );

            console.log(`   ✅ User ${i + 1} (${user.publicKey.toString().slice(0, 8)}...) received ${tokensPerUser} TATA tokens`);
            console.log(`   🏦 Token Account: ${userTokenAccount.toString()}`);
        }

        // Step 4: Create payment mint (SOL equivalent for testing)
        console.log("\n💰 Step 4: Setting up payment system...");
        const paymentMint = await createMint(
            provider.connection,
            admin.payer,
            admin.publicKey,
            null,
            6
        );
        console.log(`   ✅ Payment mint created: ${paymentMint.toString()}`);

        // Create payment accounts for all users and fund them
        const userPaymentAccounts = [];
        for (let i = 0; i < 6; i++) {
            const user = [user1, user2, user3, user4, user5, user6][i];
            const paymentAccount = await createAccount(
                provider.connection,
                admin.payer,
                paymentMint,
                user.publicKey
            );

            // Fund with payment tokens (representing SOL)
            await mintTo(
                provider.connection,
                admin.payer,
                paymentMint,
                paymentAccount,
                admin.publicKey,
                10000 * 1000000, // 10,000 payment tokens
                [admin.payer]
            );

            userPaymentAccounts.push(paymentAccount);
            console.log(`   ✅ User ${i + 1} payment account: ${paymentAccount.toString()} (10,000 tokens)`);
        }

        // Step 5: Execute trading scenario
        console.log("\n📊 Step 5: Executing Trading Scenario...");

        // User 1 sells 50 tokens for 120 SOL
        console.log("\n   🔴 User 1 selling 50 TATA tokens at 120 SOL each...");
        const user1TokenAccount = await createAccount(
            provider.connection,
            admin.payer,
            tokenMintPda,
            user1.publicKey
        );

        // For this demonstration, we'll use the existing create_sell_order function
        const [sellOrder1Pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("order"),
                user1.publicKey.toBuffer(),
                Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]) // order_id = 1
            ],
            program.programId
        );

        const [sellOrder1EscrowPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("order_escrow"),
                user1.publicKey.toBuffer(),
                Buffer.from([1, 0, 0, 0, 0, 0, 0, 0])
            ],
            program.programId
        );

        await program.methods
            .createSellOrder(
                new anchor.BN(50 * 1000000), // 50 tokens
                new anchor.BN(120 * 1000000)  // 120 SOL per token
            )
            .accounts({
                platform: platformPda,
                company: companyPda,
                order: sellOrder1Pda,
                orderEscrowAccount: sellOrder1EscrowPda,
                userTokenAccount: user1TokenAccount,
                tokenMint: tokenMintPda,
                user: user1.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([user1])
            .rpc();

        console.log("   ✅ Sell order created:");
        console.log(`      📝 Order ID: 1`);
        console.log(`      👤 User: ${user1.publicKey.toString().slice(0, 8)}...`);
        console.log(`      📦 Amount: 50 TATA tokens`);
        console.log(`      💰 Price: 120 SOL per token`);
        console.log(`      🏦 Order Address: ${sellOrder1Pda.toString()}`);

        // Print final summary
        console.log("\n📊 TRADING SCENARIO SUMMARY");
        console.log("=" * 50);
        console.log(`🏢 Company: Tata Motors (TATA)`);
        console.log(`🆔 Company ID: ${companyId}`);
        console.log(`📍 Company Address: ${companyPda.toString()}`);
        console.log(`🪙 Token Mint: ${tokenMintPda.toString()}`);
        console.log(`📈 Orderbook: ${orderbookPda.toString()}`);
        console.log(`💰 Payment Mint: ${paymentMint.toString()}`);

        console.log("\n👥 USER ACCOUNTS:");
        const users = [user1, user2, user3, user4, user5, user6];
        for (let i = 0; i < users.length; i++) {
            console.log(`   User ${i + 1}:`);
            console.log(`      🔑 Address: ${users[i].publicKey.toString()}`);
            console.log(`      💰 Payment Account: ${userPaymentAccounts[i].toString()}`);
            if (i < 4) {
                console.log(`      🪙 Initial TATA Tokens: 250`);
            } else {
                console.log(`      🪙 Initial TATA Tokens: 0 (not in initial distribution)`);
            }
        }

        console.log("\n📋 ORDERS CREATED:");
        console.log(`   📝 Sell Order 1:`);
        console.log(`      👤 User: ${user1.publicKey.toString().slice(0, 8)}...`);
        console.log(`      📦 Amount: 50 TATA tokens`);
        console.log(`      💰 Price: 120 SOL per token`);
        console.log(`      🏦 Order Address: ${sellOrder1Pda.toString()}`);
        console.log(`      🔐 Escrow Address: ${sellOrder1EscrowPda.toString()}`);

        console.log("\n✅ TATA Company DeFi Trading Platform Test Completed Successfully!");
        console.log("\n📝 Next Steps:");
        console.log("   • Add more sell orders from User 2");
        console.log("   • Add buy orders from Users 3, 4, 5, 6");
        console.log("   • Execute trades between buyers and sellers");
        console.log("   • View market depth and orderbook status");

    } catch (error) {
        console.error("\n❌ Error occurred:", error);
        console.error("Error details:", error.logs || error.message);
    }
}

// Run the scenario
runTataScenario()
    .then(() => {
        console.log("\n🎉 Script execution completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Script failed:", error);
        process.exit(1);
    });