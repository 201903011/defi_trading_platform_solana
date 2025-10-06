import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DefiTradingPlatform } from "../target/types/defi_trading_platform";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount
} from "@solana/spl-token";
import { expect } from "chai";

describe("DeFi Trading Platform", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.defiTradingPlatform as Program<DefiTradingPlatform>;
  const provider = anchor.AnchorProvider.env();

  // Test accounts
  let platformAuthority: anchor.web3.Keypair;
  let companyAuthority: anchor.web3.Keypair;
  let user1: anchor.web3.Keypair;
  let user2: anchor.web3.Keypair;

  // PDAs
  let platformPda: anchor.web3.PublicKey;
  let companyPda: anchor.web3.PublicKey;
  let tokenMintPda: anchor.web3.PublicKey;
  let tokenOfferingPda: anchor.web3.PublicKey;
  let user1PortfolioPda: anchor.web3.PublicKey;
  let user2PortfolioPda: anchor.web3.PublicKey;

  // Token accounts
  let paymentMint: anchor.web3.PublicKey;
  let user1PaymentAccount: anchor.web3.PublicKey;
  let user2PaymentAccount: anchor.web3.PublicKey;
  let platformPaymentAccount: anchor.web3.PublicKey;

  before(async () => {
    // Generate keypairs
    platformAuthority = anchor.web3.Keypair.generate();
    companyAuthority = anchor.web3.Keypair.generate();
    user1 = anchor.web3.Keypair.generate();
    user2 = anchor.web3.Keypair.generate();

    // Airdrop SOL
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(platformAuthority.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(companyAuthority.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user2.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );

    // Create payment token mint
    paymentMint = await createMint(
      provider.connection,
      platformAuthority,
      platformAuthority.publicKey,
      null,
      6
    );

    // Create payment token accounts
    user1PaymentAccount = await createAccount(
      provider.connection,
      user1,
      paymentMint,
      user1.publicKey
    );

    user2PaymentAccount = await createAccount(
      provider.connection,
      user2,
      paymentMint,
      user2.publicKey
    );

    platformPaymentAccount = await createAccount(
      provider.connection,
      platformAuthority,
      paymentMint,
      platformAuthority.publicKey
    );

    // Mint payment tokens to users
    await mintTo(
      provider.connection,
      platformAuthority,
      paymentMint,
      user1PaymentAccount,
      platformAuthority,
      1000000 * 10 ** 6 // 1M tokens
    );

    await mintTo(
      provider.connection,
      platformAuthority,
      paymentMint,
      user2PaymentAccount,
      platformAuthority,
      1000000 * 10 ** 6 // 1M tokens
    );

    // Calculate PDAs
    [platformPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("platform")],
      program.programId
    );
  });

  describe("Platform Management", () => {
    it("Initialize platform", async () => {
      const tx = await program.methods
        .initializePlatform()
        .accounts({
          platform: platformPda,
          authority: platformAuthority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([platformAuthority])
        .rpc();

      const platformAccount = await program.account.platform.fetch(platformPda);
      expect(platformAccount.authority.toString()).to.equal(platformAuthority.publicKey.toString());
      expect(platformAccount.totalCompanies.toNumber()).to.equal(0);
      expect(platformAccount.platformFee).to.equal(100); // 1%
      expect(platformAccount.isPaused).to.be.false;
    });
  });

  describe("Company Management", () => {
    it("Register a company", async () => {
      const companyId = 1;

      [companyPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("company"), Buffer.from(companyId.toString().padStart(8, "0"), "hex")],
        program.programId
      );

      [tokenMintPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("token_mint"), Buffer.from(companyId.toString().padStart(8, "0"), "hex")],
        program.programId
      );

      const tx = await program.methods
        .registerCompany("Test Company", "TEST", "A test company for DeFi trading")
        .accounts({
          platform: platformPda,
          company: companyPda,
          tokenMint: tokenMintPda,
          authority: companyAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([companyAuthority])
        .rpc();

      const companyAccount = await program.account.company.fetch(companyPda);
      expect(companyAccount.name).to.equal("Test Company");
      expect(companyAccount.symbol).to.equal("TEST");
      expect(companyAccount.authority.toString()).to.equal(companyAuthority.publicKey.toString());
      expect(companyAccount.id.toNumber()).to.equal(1);

      const platformAccount = await program.account.platform.fetch(platformPda);
      expect(platformAccount.totalCompanies.toNumber()).to.equal(1);
    });
  });

  describe("Token Offering", () => {
    it("Create token offering", async () => {
      const offeringId = 1;

      [tokenOfferingPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("token_offering"), Buffer.from(offeringId.toString().padStart(8, "0"), "hex")],
        program.programId
      );

      const [offeringTokenAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("offering_tokens"), Buffer.from(offeringId.toString().padStart(8, "0"), "hex")],
        program.programId
      );

      const totalSupply = new anchor.BN(1000000); // 1M tokens
      const pricePerToken = new anchor.BN(1000000); // 1 USDC per token (6 decimals)
      const offeringStart = new anchor.BN(Math.floor(Date.now() / 1000) + 10); // Start in 10 seconds
      const offeringEnd = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // End in 1 hour

      const tx = await program.methods
        .createTokenOffering(totalSupply, pricePerToken, offeringStart, offeringEnd)
        .accounts({
          platform: platformPda,
          company: companyPda,
          tokenOffering: tokenOfferingPda,
          tokenMint: tokenMintPda,
          offeringTokenAccount: offeringTokenAccountPda,
          authority: companyAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([companyAuthority])
        .rpc();

      const offeringAccount = await program.account.tokenOffering.fetch(tokenOfferingPda);
      expect(offeringAccount.totalSupply.toString()).to.equal(totalSupply.toString());
      expect(offeringAccount.pricePerToken.toString()).to.equal(pricePerToken.toString());
      expect(offeringAccount.companyId.toNumber()).to.equal(1);
    });

    it("Participate in token offering", async () => {
      // Wait for offering to start
      await new Promise(resolve => setTimeout(resolve, 11000));

      const [participationPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("participation"), user1.publicKey.toBuffer(), Buffer.from("1".padStart(8, "0"), "hex")],
        program.programId
      );

      const [offeringTokenAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("offering_tokens"), Buffer.from("1".padStart(8, "0"), "hex")],
        program.programId
      );

      const user1TokenAccount = await createAccount(
        provider.connection,
        user1,
        tokenMintPda,
        user1.publicKey
      );

      const investmentAmount = new anchor.BN(100000000); // 100 USDC

      const tx = await program.methods
        .participateInOffering(investmentAmount)
        .accounts({
          tokenOffering: tokenOfferingPda,
          participation: participationPda,
          offeringTokenAccount: offeringTokenAccountPda,
          userTokenAccount: user1TokenAccount,
          userPaymentAccount: user1PaymentAccount,
          platformPaymentAccount: platformPaymentAccount,
          user: user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user1])
        .rpc();

      const participationAccount = await program.account.offeringParticipation.fetch(participationPda);
      expect(participationAccount.amountInvested.toString()).to.equal(investmentAmount.toString());
      expect(participationAccount.user.toString()).to.equal(user1.publicKey.toString());
    });
  });

  describe("Portfolio Management", () => {
    it("Create user portfolio", async () => {
      [user1PortfolioPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("portfolio"), user1.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .createPortfolio()
        .accounts({
          portfolio: user1PortfolioPda,
          user: user1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const portfolioAccount = await program.account.portfolio.fetch(user1PortfolioPda);
      expect(portfolioAccount.user.toString()).to.equal(user1.publicKey.toString());
      expect(portfolioAccount.totalHoldings.toNumber()).to.equal(0);
    });
  });

  describe("Trading", () => {
    let sellOrderPda: anchor.web3.PublicKey;
    let buyOrderPda: anchor.web3.PublicKey;
    let user1TokenAccount: anchor.web3.PublicKey;
    let user2TokenAccount: anchor.web3.PublicKey;

    before(async () => {
      // Create token accounts for users
      user1TokenAccount = await createAccount(
        provider.connection,
        user1,
        tokenMintPda,
        user1.publicKey
      );

      user2TokenAccount = await createAccount(
        provider.connection,
        user2,
        tokenMintPda,
        user2.publicKey
      );

      // Create portfolio for user2
      [user2PortfolioPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("portfolio"), user2.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .createPortfolio()
        .accounts({
          portfolio: user2PortfolioPda,
          user: user2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user2])
        .rpc();
    });

    it("Create sell order", async () => {
      const orderId = 1;

      [sellOrderPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("order"), user1.publicKey.toBuffer(), Buffer.from(orderId.toString().padStart(8, "0"), "hex")],
        program.programId
      );

      const [orderEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("order_escrow"), user1.publicKey.toBuffer(), Buffer.from(orderId.toString().padStart(8, "0"), "hex")],
        program.programId
      );

      const amount = new anchor.BN(1000); // 1000 tokens
      const price = new anchor.BN(1100000); // 1.1 USDC per token

      const tx = await program.methods
        .createSellOrder(amount, price)
        .accounts({
          platform: platformPda,
          company: companyPda,
          order: sellOrderPda,
          orderEscrowAccount: orderEscrowPda,
          userTokenAccount: user1TokenAccount,
          user: user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user1])
        .rpc();

      const orderAccount = await program.account.order.fetch(sellOrderPda);
      expect(orderAccount.amount.toString()).to.equal(amount.toString());
      expect(orderAccount.price.toString()).to.equal(price.toString());
      expect(orderAccount.user.toString()).to.equal(user1.publicKey.toString());
    });

    it("Create buy order", async () => {
      const orderId = 2;

      [buyOrderPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("order"), user2.publicKey.toBuffer(), Buffer.from(orderId.toString().padStart(8, "0"), "hex")],
        program.programId
      );

      const [orderEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("order_escrow"), user2.publicKey.toBuffer(), Buffer.from(orderId.toString().padStart(8, "0"), "hex")],
        program.programId
      );

      const amount = new anchor.BN(500); // 500 tokens
      const price = new anchor.BN(1200000); // 1.2 USDC per token

      const tx = await program.methods
        .createBuyOrder(amount, price)
        .accounts({
          platform: platformPda,
          company: companyPda,
          order: buyOrderPda,
          orderEscrowAccount: orderEscrowPda,
          userPaymentAccount: user2PaymentAccount,
          paymentMint: paymentMint,
          user: user2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user2])
        .rpc();

      const orderAccount = await program.account.order.fetch(buyOrderPda);
      expect(orderAccount.amount.toString()).to.equal(amount.toString());
      expect(orderAccount.price.toString()).to.equal(price.toString());
      expect(orderAccount.user.toString()).to.equal(user2.publicKey.toString());
    });
  });

  describe("Error Cases", () => {
    it("Should fail to register company with empty name", async () => {
      try {
        const companyId = 2;

        const [invalidCompanyPda] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("company"), Buffer.from(companyId.toString().padStart(8, "0"), "hex")],
          program.programId
        );

        const [invalidTokenMintPda] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("token_mint"), Buffer.from(companyId.toString().padStart(8, "0"), "hex")],
          program.programId
        );

        await program.methods
          .registerCompany("", "EMPTY", "Company with empty name")
          .accounts({
            platform: platformPda,
            company: invalidCompanyPda,
            tokenMint: invalidTokenMintPda,
            authority: companyAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([companyAuthority])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidCompanyData");
      }
    });

    it("Should fail to create offering with zero supply", async () => {
      try {
        const offeringId = 2;

        const [invalidOfferingPda] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("token_offering"), Buffer.from(offeringId.toString().padStart(8, "0"), "hex")],
          program.programId
        );

        const [invalidOfferingTokenAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("offering_tokens"), Buffer.from(offeringId.toString().padStart(8, "0"), "hex")],
          program.programId
        );

        await program.methods
          .createTokenOffering(
            new anchor.BN(0), // Zero supply
            new anchor.BN(1000000),
            new anchor.BN(Math.floor(Date.now() / 1000) + 10),
            new anchor.BN(Math.floor(Date.now() / 1000) + 3600)
          )
          .accounts({
            platform: platformPda,
            company: companyPda,
            tokenOffering: invalidOfferingPda,
            tokenMint: tokenMintPda,
            offeringTokenAccount: invalidOfferingTokenAccountPda,
            authority: companyAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([companyAuthority])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidOfferingParams");
      }
    });
  });
});
