const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createAssociatedTokenAccount } = require('@solana/spl-token');

describe('Tata Company Complete Trading Scenario', () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.DefiTradingPlatform;

    // Platform and authority
    let platformAuthority;
    let platformPda;

    // Tata company
    let tataCompany;
    let tataTokenMint;
    let tataCompanyPda;

    // Token offering
    let tataOffering;
    let tataOfferingPda;

    // Users 1-6
    let user1, user2, user3, user4, user5, user6;
    let user1Portfolio, user2Portfolio, user3Portfolio, user4Portfolio, user5Portfolio, user6Portfolio;
    let user1TokenAccount, user2TokenAccount, user3TokenAccount, user4TokenAccount, user5TokenAccount, user6TokenAccount;

    // Orders
    let sellOrder1, sellOrder2, buyOrder3, buyOrder4, buyOrder5, buyOrder6;

    console.log('🏢 TATA COMPANY COMPLETE TRADING SCENARIO');
    console.log('=========================================');

    before(async () => {
        // Initialize platform authority
        platformAuthority = anchor.web3.Keypair.generate();

        // Airdrop SOL to platform authority
        const airdropTx = await provider.connection.requestAirdrop(
            platformAuthority.publicKey,
            10 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(airdropTx);

        // Generate Tata company authority
        tataCompany = anchor.web3.Keypair.generate();

        // Airdrop SOL to Tata company
        const companyAirdrop = await provider.connection.requestAirdrop(
            tataCompany.publicKey,
            5 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(companyAirdrop);

        // Generate 6 users
        user1 = anchor.web3.Keypair.generate();
        user2 = anchor.web3.Keypair.generate();
        user3 = anchor.web3.Keypair.generate();
        user4 = anchor.web3.Keypair.generate();
        user5 = anchor.web3.Keypair.generate();
        user6 = anchor.web3.Keypair.generate();

        // Airdrop SOL to all users
        const users = [user1, user2, user3, user4, user5, user6];
        for (let i = 0; i < users.length; i++) {
            const airdrop = await provider.connection.requestAirdrop(
                users[i].publicKey,
                10 * LAMPORTS_PER_SOL
            );
            await provider.connection.confirmTransaction(airdrop);
        }

        console.log('\\n📍 ACCOUNT ADDRESSES GENERATED:');
        console.log('Platform Authority:', platformAuthority.publicKey.toString());
        console.log('Tata Company Authority:', tataCompany.publicKey.toString());
        console.log('User 1:', user1.publicKey.toString());
        console.log('User 2:', user2.publicKey.toString());
        console.log('User 3:', user3.publicKey.toString());
        console.log('User 4:', user4.publicKey.toString());
        console.log('User 5:', user5.publicKey.toString());
        console.log('User 6:', user6.publicKey.toString());
    });

    it("1. Initialize Platform", async () => {
        const [platformPdaAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform")],
            program.programId
        );
        platformPda = platformPdaAddress;

        try {
            await program.account.platform.fetch(platformPda);
            console.log('✅ Platform already initialized');
        } catch (error) {
            const tx = await program.methods
                .initializePlatform()
                .accounts({
                    platform: platformPda,
                    authority: platformAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([platformAuthority])
                .rpc();

            console.log('✅ Platform initialized');
            console.log('Transaction:', tx);
        }

        console.log('Platform PDA:', platformPda.toString());
    });

    it("2. Register Tata Company", async () => {
        // Get platform data to determine company ID
        const platformData = await program.account.platform.fetch(platformPda);
        const companyId = platformData.totalCompanies.toNumber() + 1;

        // Create company PDA
        const companyIdBuffer = Buffer.allocUnsafe(8);
        companyIdBuffer.writeUInt32LE(companyId, 0);
        companyIdBuffer.writeUInt32LE(0, 4);

        const [companyPdaAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from("company"), companyIdBuffer],
            program.programId
        );
        tataCompanyPda = companyPdaAddress;

        // Create token mint
        tataTokenMint = anchor.web3.Keypair.generate();

        const tx = await program.methods
            .registerCompany(
                "Tata Group",
                "TATA",
                "Leading Indian multinational conglomerate company"
            )
            .accounts({
                platform: platformPda,
                company: tataCompanyPda,
                authority: tataCompany.publicKey,
                tokenMint: tataTokenMint.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([tataCompany, tataTokenMint])
            .rpc();

        console.log('\\n🏢 TATA COMPANY REGISTERED:');
        console.log('Company ID:', companyId);
        console.log('Company PDA:', tataCompanyPda.toString());
        console.log('Token Mint:', tataTokenMint.publicKey.toString());
        console.log('Transaction:', tx);
    });

    it("3. Create Tata Token Offering (1000 tokens at 100 lamports each)", async () => {
        // Get company data
        const companyData = await program.account.company.fetch(tataCompanyPda);
        const platformData = await program.account.platform.fetch(platformPda);
        const offeringId = platformData.totalOfferings.toNumber() + 1;

        // Create offering PDA
        const companyIdBuffer = Buffer.allocUnsafe(8);
        companyIdBuffer.writeUInt32LE(companyData.id.toNumber(), 0);
        companyIdBuffer.writeUInt32LE(0, 4);

        const offeringIdBuffer = Buffer.allocUnsafe(8);
        offeringIdBuffer.writeUInt32LE(offeringId, 0);
        offeringIdBuffer.writeUInt32LE(0, 4);

        const [offeringPdaAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from("offering"), companyIdBuffer, offeringIdBuffer],
            program.programId
        );
        tataOfferingPda = offeringPdaAddress;

        // Create offering token account
        const [offeringTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("offering_escrow"), tataOfferingPda.toBuffer()],
            program.programId
        );

        const currentTime = Math.floor(Date.now() / 1000);
        const offeringStart = currentTime + 10; // Start in 10 seconds
        const offeringEnd = currentTime + 3600; // End in 1 hour

        const tx = await program.methods
            .createTokenOffering(
                new anchor.BN(1000), // Total supply: 1000 tokens
                new anchor.BN(100),  // Price: 100 lamports per token
                new anchor.BN(offeringStart),
                new anchor.BN(offeringEnd)
            )
            .accounts({
                platform: platformPda,
                company: tataCompanyPda,
                tokenOffering: tataOfferingPda,
                authority: tataCompany.publicKey,
                tokenMint: tataTokenMint.publicKey,
                offeringTokenAccount: offeringTokenAccount,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([tataCompany])
            .rpc();

        console.log('\\n💰 TATA TOKEN OFFERING CREATED:');
        console.log('Offering ID:', offeringId);
        console.log('Offering PDA:', tataOfferingPda.toString());
        console.log('Total Supply: 1000 tokens');
        console.log('Price: 100 lamports per token');
        console.log('Offering Token Account:', offeringTokenAccount.toString());
        console.log('Transaction:', tx);

        // Wait for offering to start
        console.log('⏳ Waiting for offering to start...');
        await new Promise(resolve => setTimeout(resolve, 15000));
    });

    it("4. Users 1-4 Participate in Offering (250 tokens each)", async () => {
        const users = [
            { keypair: user1, name: 'User 1' },
            { keypair: user2, name: 'User 2' },
            { keypair: user3, name: 'User 3' },
            { keypair: user4, name: 'User 4' }
        ];

        console.log('\\n👥 USERS PARTICIPATING IN OFFERING:');

        for (let i = 0; i < users.length; i++) {
            const user = users[i];

            // Create portfolio PDA
            const [portfolioPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("portfolio"), user.keypair.publicKey.toBuffer()],
                program.programId
            );

            // Create user token account
            const userTokenAccount = await getAssociatedTokenAddress(
                tataTokenMint.publicKey,
                user.keypair.publicKey
            );

            // Create associated token account if it doesn't exist
            try {
                await createAssociatedTokenAccount(
                    provider.connection,
                    user.keypair,
                    tataTokenMint.publicKey,
                    user.keypair.publicKey
                );
            } catch (e) {
                // Account might already exist
            }

            // Get offering escrow account
            const [offeringTokenAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("offering_escrow"), tataOfferingPda.toBuffer()],
                program.programId
            );

            // Get offering payment account (platform's SOL account)
            const [offeringPaymentAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("offering_payment"), tataOfferingPda.toBuffer()],
                program.programId
            );

            const tx = await program.methods
                .participateInOffering(new anchor.BN(250)) // 250 tokens each
                .accounts({
                    tokenOffering: tataOfferingPda,
                    user: user.keypair.publicKey,
                    portfolio: portfolioPda,
                    userTokenAccount: userTokenAccount,
                    userPaymentAccount: user.keypair.publicKey, // Using user's SOL account
                    offeringTokenAccount: offeringTokenAccount,
                    offeringPaymentAccount: offeringPaymentAccount,
                    tokenMint: tataTokenMint.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([user.keypair])
                .rpc();

            console.log(`✅ ${user.name} participated:`);
            console.log(`   Portfolio: ${portfolioPda.toString()}`);
            console.log(`   Token Account: ${userTokenAccount.toString()}`);
            console.log(`   Tokens Purchased: 250`);
            console.log(`   Cost: 25,000 lamports`);
            console.log(`   Transaction: ${tx}`);

            // Store references
            if (i === 0) {
                user1Portfolio = portfolioPda;
                user1TokenAccount = userTokenAccount;
            } else if (i === 1) {
                user2Portfolio = portfolioPda;
                user2TokenAccount = userTokenAccount;
            } else if (i === 2) {
                user3Portfolio = portfolioPda;
                user3TokenAccount = userTokenAccount;
            } else if (i === 3) {
                user4Portfolio = portfolioPda;
                user4TokenAccount = userTokenAccount;
            }
        }
    });

    it("5. User 1 Creates Sell Order (50 tokens at 120 lamports)", async () => {
        const platformData = await program.account.platform.fetch(platformPda);
        const orderId = platformData.totalTrades.toNumber() + 1;

        const orderIdBuffer = Buffer.allocUnsafe(8);
        orderIdBuffer.writeUInt32LE(orderId, 0);
        orderIdBuffer.writeUInt32LE(0, 4);

        const [sellOrderPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("order"), user1.publicKey.toBuffer(), orderIdBuffer],
            program.programId
        );

        const [orderEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("order_escrow"), user1.publicKey.toBuffer(), orderIdBuffer],
            program.programId
        );

        const tx = await program.methods
            .createSellOrder(
                new anchor.BN(50),  // 50 tokens
                new anchor.BN(120)  // 120 lamports per token
            )
            .accounts({
                platform: platformPda,
                order: sellOrderPda,
                user: user1.publicKey,
                company: tataCompanyPda,
                userTokenAccount: user1TokenAccount,
                orderEscrowAccount: orderEscrowPda,
                tokenMint: tataTokenMint.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([user1])
            .rpc();

        sellOrder1 = sellOrderPda;

        console.log('\\n📤 USER 1 SELL ORDER CREATED:');
        console.log('Order ID:', orderId);
        console.log('Sell Order PDA:', sellOrderPda.toString());
        console.log('Order Escrow:', orderEscrowPda.toString());
        console.log('Quantity: 50 tokens');
        console.log('Price: 120 lamports per token');
        console.log('Total Value: 6,000 lamports');
        console.log('Transaction:', tx);
    });

    it("6. User 2 Creates Sell Order (70 tokens at 110 lamports)", async () => {
        const platformData = await program.account.platform.fetch(platformPda);
        const orderId = platformData.totalTrades.toNumber() + 1;

        const orderIdBuffer = Buffer.allocUnsafe(8);
        orderIdBuffer.writeUInt32LE(orderId, 0);
        orderIdBuffer.writeUInt32LE(0, 4);

        const [sellOrderPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("order"), user2.publicKey.toBuffer(), orderIdBuffer],
            program.programId
        );

        const [orderEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("order_escrow"), user2.publicKey.toBuffer(), orderIdBuffer],
            program.programId
        );

        const tx = await program.methods
            .createSellOrder(
                new anchor.BN(70),  // 70 tokens
                new anchor.BN(110)  // 110 lamports per token
            )
            .accounts({
                platform: platformPda,
                order: sellOrderPda,
                user: user2.publicKey,
                company: tataCompanyPda,
                userTokenAccount: user2TokenAccount,
                orderEscrowAccount: orderEscrowPda,
                tokenMint: tataTokenMint.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([user2])
            .rpc();

        sellOrder2 = sellOrderPda;

        console.log('\\n📤 USER 2 SELL ORDER CREATED:');
        console.log('Order ID:', orderId);
        console.log('Sell Order PDA:', sellOrderPda.toString());
        console.log('Order Escrow:', orderEscrowPda.toString());
        console.log('Quantity: 70 tokens');
        console.log('Price: 110 lamports per token');
        console.log('Total Value: 7,700 lamports');
        console.log('Transaction:', tx);
    });

    it("7. User 3 Creates Buy Order (30 tokens at market price - 110 lamports)", async () => {
        // Create portfolio for user 3 (they already have tokens but need portfolio for trading)
        const [user3PortfolioPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("portfolio"), user3.publicKey.toBuffer()],
            program.programId
        );

        const platformData = await program.account.platform.fetch(platformPda);
        const orderId = platformData.totalTrades.toNumber() + 1;

        const orderIdBuffer = Buffer.allocUnsafe(8);
        orderIdBuffer.writeUInt32LE(orderId, 0);
        orderIdBuffer.writeUInt32LE(0, 4);

        const [buyOrderPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("order"), user3.publicKey.toBuffer(), orderIdBuffer],
            program.programId
        );

        const [orderEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("order_escrow"), user3.publicKey.toBuffer(), orderIdBuffer],
            program.programId
        );

        const tx = await program.methods
            .createBuyOrder(
                new anchor.BN(30),  // 30 tokens
                new anchor.BN(110)  // 110 lamports per token (market price)
            )
            .accounts({
                platform: platformPda,
                order: buyOrderPda,
                user: user3.publicKey,
                company: tataCompanyPda,
                userPaymentAccount: user3.publicKey,
                orderEscrowAccount: orderEscrowPda,
                tokenMint: tataTokenMint.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([user3])
            .rpc();

        buyOrder3 = buyOrderPda;

        console.log('\\n📥 USER 3 BUY ORDER CREATED:');
        console.log('Order ID:', orderId);
        console.log('Buy Order PDA:', buyOrderPda.toString());
        console.log('Order Escrow:', orderEscrowPda.toString());
        console.log('Quantity: 30 tokens');
        console.log('Price: 110 lamports per token (market price)');
        console.log('Total Cost: 3,300 lamports');
        console.log('Transaction:', tx);
    });

    it("8. Display Current Market State", async () => {
        console.log('\\n📊 CURRENT MARKET STATE:');
        console.log('========================');

        console.log('\\n🏢 TATA COMPANY:');
        const companyData = await program.account.company.fetch(tataCompanyPda);
        console.log(`Name: ${companyData.name}`);
        console.log(`Symbol: ${companyData.symbol}`);
        console.log(`Total Supply: ${companyData.totalSupply.toString()}`);
        console.log(`Circulating Supply: ${companyData.circulatingSupply.toString()}`);

        console.log('\\n💰 TOKEN OFFERING:');
        const offeringData = await program.account.tokenOffering.fetch(tataOfferingPda);
        console.log(`Remaining Supply: ${offeringData.remainingSupply.toString()}`);
        console.log(`Total Raised: ${offeringData.totalRaised.toString()}`);
        console.log(`Participants: ${offeringData.participantsCount.toString()}`);

        console.log('\\n👥 USER PORTFOLIOS:');
        try {
            const portfolio1 = await program.account.portfolio.fetch(user1Portfolio);
            console.log(`User 1: ${portfolio1.tokenBalance.toString()} tokens`);
        } catch (e) { console.log('User 1: No portfolio'); }

        try {
            const portfolio2 = await program.account.portfolio.fetch(user2Portfolio);
            console.log(`User 2: ${portfolio2.tokenBalance.toString()} tokens`);
        } catch (e) { console.log('User 2: No portfolio'); }

        try {
            const portfolio3 = await program.account.portfolio.fetch(user3Portfolio);
            console.log(`User 3: ${portfolio3.tokenBalance.toString()} tokens`);
        } catch (e) { console.log('User 3: No portfolio'); }

        try {
            const portfolio4 = await program.account.portfolio.fetch(user4Portfolio);
            console.log(`User 4: ${portfolio4.tokenBalance.toString()} tokens`);
        } catch (e) { console.log('User 4: No portfolio'); }

        console.log('\\n📋 ACTIVE ORDERS:');
        try {
            const sellOrder1Data = await program.account.order.fetch(sellOrder1);
            console.log(`Sell Order 1: ${sellOrder1Data.remainingAmount.toString()} tokens at ${sellOrder1Data.price.toString()} lamports`);
        } catch (e) { console.log('Sell Order 1: Error fetching'); }

        try {
            const sellOrder2Data = await program.account.order.fetch(sellOrder2);
            console.log(`Sell Order 2: ${sellOrder2Data.remainingAmount.toString()} tokens at ${sellOrder2Data.price.toString()} lamports`);
        } catch (e) { console.log('Sell Order 2: Error fetching'); }

        try {
            const buyOrder3Data = await program.account.order.fetch(buyOrder3);
            console.log(`Buy Order 3: ${buyOrder3Data.remainingAmount.toString()} tokens at ${buyOrder3Data.price.toString()} lamports`);
        } catch (e) { console.log('Buy Order 3: Error fetching'); }
    });

    it("9. Summary of All Addresses and Details", async () => {
        console.log('\\n📋 COMPLETE ADDRESS SUMMARY:');
        console.log('=============================');

        console.log('\\n🏛️ PLATFORM:');
        console.log(`Program ID: ${program.programId.toString()}`);
        console.log(`Platform PDA: ${platformPda.toString()}`);
        console.log(`Platform Authority: ${platformAuthority.publicKey.toString()}`);

        console.log('\\n🏢 TATA COMPANY:');
        console.log(`Company Authority: ${tataCompany.publicKey.toString()}`);
        console.log(`Company PDA: ${tataCompanyPda.toString()}`);
        console.log(`Token Mint: ${tataTokenMint.publicKey.toString()}`);
        console.log(`Token Offering PDA: ${tataOfferingPda.toString()}`);

        console.log('\\n👥 USERS:');
        console.log(`User 1: ${user1.publicKey.toString()}`);
        console.log(`  Portfolio: ${user1Portfolio.toString()}`);
        console.log(`  Token Account: ${user1TokenAccount.toString()}`);
        console.log(`  Sell Order: ${sellOrder1.toString()}`);

        console.log(`User 2: ${user2.publicKey.toString()}`);
        console.log(`  Portfolio: ${user2Portfolio.toString()}`);
        console.log(`  Token Account: ${user2TokenAccount.toString()}`);
        console.log(`  Sell Order: ${sellOrder2.toString()}`);

        console.log(`User 3: ${user3.publicKey.toString()}`);
        console.log(`  Portfolio: ${user3Portfolio.toString()}`);
        console.log(`  Token Account: ${user3TokenAccount.toString()}`);
        console.log(`  Buy Order: ${buyOrder3.toString()}`);

        console.log(`User 4: ${user4.publicKey.toString()}`);
        console.log(`  Portfolio: ${user4Portfolio.toString()}`);
        console.log(`  Token Account: ${user4TokenAccount.toString()}`);

        console.log(`User 5: ${user5.publicKey.toString()}`);
        console.log(`User 6: ${user6.publicKey.toString()}`);

        console.log('\\n💹 MARKET DATA:');
        console.log('Initial Token Offering: 1000 tokens at 100 lamports each');
        console.log('User 1-4 each bought: 250 tokens (25,000 lamports each)');
        console.log('User 1 selling: 50 tokens at 120 lamports each');
        console.log('User 2 selling: 70 tokens at 110 lamports each');
        console.log('User 3 buying: 30 tokens at 110 lamports each');

        console.log('\\n✅ SCENARIO COMPLETED SUCCESSFULLY!');
    });
});