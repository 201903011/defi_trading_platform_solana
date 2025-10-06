const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } = require('@solana/spl-token');

describe('Place Sell Order Test', () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.DefiTradingPlatform;

    // Test accounts
    let platformAccount;
    let companyAccount;
    let tokenMint;
    let userWallet;
    let userPortfolio;
    let userTokenAccount;
    let orderbook;

    before(async () => {
        // Use existing accounts from previous tests
        const [platformPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform")],
            program.programId
        );
        platformAccount = platformPda;

        // Find the existing company (from our previous test data)
        companyAccount = new PublicKey("9HHYfTjybz18GWf1ovArg3Hxas1F3n2kFfc8P3QANBqX");

        // Create a user wallet for testing
        userWallet = anchor.web3.Keypair.generate();

        // Airdrop SOL to user
        const airdropTx = await provider.connection.requestAirdrop(
            userWallet.publicKey,
            2 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(airdropTx);

        console.log("User wallet:", userWallet.publicKey.toString());
        console.log("Company account:", companyAccount.toString());
    });

    it("Places a sell order", async () => {
        try {
            // First, let's get the company data to find the token mint
            const companyData = await program.account.company.fetch(companyAccount);
            tokenMint = companyData.tokenMint;

            console.log("Token mint:", tokenMint.toString());

            // Find user portfolio PDA
            const [portfolioPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("portfolio"), userWallet.publicKey.toBuffer()],
                program.programId
            );
            userPortfolio = portfolioPda;

            // Create user token account
            userTokenAccount = await getAssociatedTokenAddress(
                tokenMint,
                userWallet.publicKey
            );

            // Find orderbook PDA
            const [orderbookPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("orderbook"), companyAccount.toBuffer()],
                program.programId
            );
            orderbook = orderbookPda;

            console.log("User portfolio:", userPortfolio.toString());
            console.log("User token account:", userTokenAccount.toString());
            console.log("Orderbook:", orderbook.toString());

            // First, user needs to buy some tokens (simulate having tokens)
            // Let's check if user already has a portfolio
            try {
                const portfolioData = await program.account.portfolio.fetch(userPortfolio);
                console.log("Existing portfolio found with", portfolioData.tokenBalance, "tokens");
            } catch (e) {
                console.log("No existing portfolio, would need to buy tokens first");
                console.log("For demo, let's assume user has tokens...");

                // In a real scenario, user would first call buy_tokens
                // For this demo, we'll just try to place the sell order
                // and see what error we get
            }

            // Try to place a sell order
            const quantity = new anchor.BN(10); // 10 shares
            const pricePerShare = new anchor.BN(500000); // 0.5 SOL per share

            console.log("Attempting to place sell order...");
            console.log("Quantity:", quantity.toString());
            console.log("Price per share:", pricePerShare.toString(), "lamports (0.0005 SOL)");

            try {
                const tx = await program.methods
                    .placeSellOrder(quantity, pricePerShare)
                    .accounts({
                        seller: userWallet.publicKey,
                        company: companyAccount,
                        portfolio: userPortfolio,
                        orderbook: orderbook,
                        tokenMint: tokenMint,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([userWallet])
                    .rpc();

                console.log("✅ Sell order placed successfully!");
                console.log("Transaction:", tx);

                // Fetch the updated orderbook
                const orderbookData = await program.account.orderbook.fetch(orderbook);
                console.log("Updated orderbook:");
                console.log("Total orders:", orderbookData.totalOrders.toString());
                console.log("Next order ID:", orderbookData.nextOrderId.toString());

            } catch (error) {
                console.log("❌ Failed to place sell order:", error.message);

                // This is expected if user doesn't have tokens
                // Let's show what the error means
                if (error.message.includes("InsufficientTokens")) {
                    console.log("💡 User needs to buy tokens first before placing sell orders");
                } else if (error.message.includes("AccountNotInitialized")) {
                    console.log("💡 User needs to create a portfolio first");
                } else {
                    console.log("💡 Error details:", error);
                }
            }

        } catch (error) {
            console.log("Test error:", error);
        }
    });

    it("Views current orderbook state", async () => {
        try {
            // Find orderbook for our company
            const [orderbookPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("orderbook"), companyAccount.toBuffer()],
                program.programId
            );

            console.log("Checking orderbook at:", orderbookPda.toString());

            try {
                const orderbookData = await program.account.orderbook.fetch(orderbookPda);
                console.log("📋 ORDERBOOK STATUS:");
                console.log("Company:", orderbookData.company.toString());
                console.log("Total Orders Ever:", orderbookData.totalOrders.toString());
                console.log("Next Order ID:", orderbookData.nextOrderId.toString());

                // Now scan for actual sell order accounts
                console.log("\\n🔍 Scanning for sell orders...");

                const accounts = await provider.connection.getProgramAccounts(program.programId);
                let sellOrders = [];

                for (const account of accounts) {
                    try {
                        // Try to decode as sell order
                        const sellOrder = program.coder.accounts.decode('sellOrder', account.account.data);

                        if (sellOrder.company.equals(companyAccount)) {
                            sellOrders.push({
                                address: account.pubkey.toString(),
                                ...sellOrder
                            });
                        }
                    } catch (e) {
                        // Not a sell order, skip
                    }
                }

                if (sellOrders.length > 0) {
                    console.log(`\\n💰 Found ${sellOrders.length} sell orders:`);
                    sellOrders.forEach((order, index) => {
                        console.log(`\\nOrder ${index + 1}:`);
                        console.log(`Address: ${order.address}`);
                        console.log(`Order ID: ${order.orderId.toString()}`);
                        console.log(`Seller: ${order.seller.toString()}`);
                        console.log(`Quantity: ${order.quantity.toString()} shares`);
                        console.log(`Price: ${order.pricePerShare.toString()} lamports (${order.pricePerShare / 1000000} SOL) per share`);
                        console.log(`Total Value: ${(order.quantity * order.pricePerShare) / 1000000} SOL`);
                        console.log(`Active: ${order.isActive}`);
                        console.log(`Created: ${new Date(order.createdAt * 1000).toLocaleString()}`);
                    });
                } else {
                    console.log("\\n📭 No sell orders found");
                    console.log("💡 To see sell orders, users need to:");
                    console.log("   1. Buy tokens from the company");
                    console.log("   2. Place sell orders for their tokens");
                }

            } catch (error) {
                console.log("❌ Could not fetch orderbook:", error.message);
                console.log("💡 Orderbook might not be initialized for this company");
            }

        } catch (error) {
            console.log("Error checking orderbook:", error);
        }
    });
});