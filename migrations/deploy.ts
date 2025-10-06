// DeFi Trading Platform Deployment Script
// This script deploys and initializes the DeFi trading platform smart contracts

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DefiTradingPlatform } from "../target/types/defi_trading_platform";
import { createMint, createAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";

module.exports = async function (provider: anchor.AnchorProvider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  const program = anchor.workspace.defiTradingPlatform as Program<DefiTradingPlatform>;

  console.log("🚀 Starting DeFi Trading Platform deployment...");
  console.log("📝 Program ID:", program.programId.toString());
  console.log("🔑 Deployer:", provider.wallet.publicKey.toString());

  try {
    // Calculate platform PDA
    const [platformPda, platformBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("platform")],
      program.programId
    );

    console.log("🏢 Platform PDA:", platformPda.toString());

    // Initialize the platform
    console.log("🔧 Initializing platform...");
    const initTx = await program.methods
      .initializePlatform()
      .accounts({
        platform: platformPda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Platform initialized! Transaction:", initTx);

    // Fetch and display platform state
    const platformAccount = await program.account.platform.fetch(platformPda);
    console.log("📊 Platform State:");
    console.log("  - Authority:", platformAccount.authority.toString());
    console.log("  - Platform Fee:", platformAccount.platformFee, "basis points");
    console.log("  - Total Companies:", platformAccount.totalCompanies.toString());
    console.log("  - Total Offerings:", platformAccount.totalOfferings.toString());
    console.log("  - Total Trades:", platformAccount.totalTrades.toString());
    console.log("  - Is Paused:", platformAccount.isPaused);

    // Create a demo payment token (USDC-like)
    console.log("💰 Creating demo payment token...");
    const paymentMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6, // 6 decimals like USDC
    );

    console.log("💰 Demo payment token created:", paymentMint.toString());

    // Create a platform payment account
    const platformPaymentAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      paymentMint,
      provider.wallet.publicKey
    );

    console.log("🏦 Platform payment account created:", platformPaymentAccount.toString());

    // Optional: Register a demo company
    console.log("🏢 Registering demo company...");
    const companyId = 1;

    const [companyPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("company"), new anchor.BN(companyId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const [tokenMintPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_mint"), new anchor.BN(companyId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      const registerTx = await program.methods
        .registerCompany("Demo Corp", "DEMO", "A demonstration company for the DeFi trading platform")
        .accounts({
          platform: platformPda,
          company: companyPda,
          tokenMint: tokenMintPda,
          authority: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("✅ Demo company registered! Transaction:", registerTx);
      console.log("🏢 Company PDA:", companyPda.toString());
      console.log("🪙 Company Token Mint:", tokenMintPda.toString());

      // Fetch and display company state
      const companyAccount = await program.account.company.fetch(companyPda);
      console.log("📊 Company State:");
      console.log("  - ID:", companyAccount.id.toString());
      console.log("  - Name:", companyAccount.name);
      console.log("  - Symbol:", companyAccount.symbol);
      console.log("  - Authority:", companyAccount.authority.toString());
      console.log("  - Token Mint:", companyAccount.tokenMint.toString());
      console.log("  - Total Supply:", companyAccount.totalSupply.toString());

    } catch (error) {
      console.log("⚠️ Demo company registration failed (may already exist):", error.message);
    }

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Deployment Summary:");
    console.log("==========================================");
    console.log("🔗 Network:", provider.connection.rpcEndpoint);
    console.log("📝 Program ID:", program.programId.toString());
    console.log("🏢 Platform PDA:", platformPda.toString());
    console.log("💰 Demo Payment Token:", paymentMint.toString());
    console.log("🏦 Platform Payment Account:", platformPaymentAccount.toString());
    console.log("==========================================");

    console.log("\n🛠️ Next Steps:");
    console.log("1. Fund user accounts with demo payment tokens");
    console.log("2. Create token offerings for registered companies");
    console.log("3. Enable trading by creating buy/sell orders");
    console.log("4. Monitor platform activity and fees");

    console.log("\n📚 Available Instructions:");
    console.log("- initializePlatform: Initialize the trading platform");
    console.log("- registerCompany: Register a new company for token issuance");
    console.log("- createTokenOffering: Create an Initial Token Offering (ITO)");
    console.log("- participateInOffering: Participate in a token offering");
    console.log("- createSellOrder: Create a sell order for tokens");
    console.log("- createBuyOrder: Create a buy order for tokens");
    console.log("- executeTrade: Execute a trade between matching orders");
    console.log("- cancelOrder: Cancel an existing order");
    console.log("- createPortfolio: Create a user portfolio");
    console.log("- updatePortfolio: Update portfolio metrics");
    console.log("- createEscrow: Create an escrow for trade security");
    console.log("- releaseEscrow: Release funds from escrow");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
};
