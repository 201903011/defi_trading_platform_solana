const { PublicKey } = require("@solana/web3.js");

// Program ID from our deployment
const programId = new PublicKey("FATJAGZjRCzP6uYLCpUdbgE5fUZxjrzPCU6dagp6iH7z");

async function getImportantAddresses() {
    console.log("=== DeFi Trading Platform - Important Addresses ===\n");

    console.log("🏛️  Program ID:", programId.toString());

    // Calculate Platform PDA
    const [platformPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform")],
        programId
    );
    console.log("🏢 Platform PDA:", platformPda.toString());
    // Calculate Company PDA (for company ID 1)
    const companyIdBuffer = Buffer.allocUnsafe(8);
    companyIdBuffer.writeUInt32LE(1, 0);
    companyIdBuffer.writeUInt32LE(0, 4);

    const [companyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("company"), companyIdBuffer],
        programId
    );
    console.log("🏪 Company #1 PDA:", companyPda.toString());

    // Calculate Token Mint PDA (for company ID 1)
    const [tokenMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_mint"), companyIdBuffer],
        programId
    );
    console.log("🪙  Token Mint PDA:", tokenMintPda.toString());

    // Calculate Token Offering PDA (for offering ID 1)
    const offeringIdBuffer = Buffer.allocUnsafe(8);
    offeringIdBuffer.writeUInt32LE(1, 0);
    offeringIdBuffer.writeUInt32LE(0, 4);

    const [tokenOfferingPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_offering"), offeringIdBuffer],
        programId
    );
    console.log("💰 Token Offering #1 PDA:", tokenOfferingPda.toString());

    // Calculate some user portfolio PDAs (example addresses)
    const exampleUserPubkey = new PublicKey("DcjakLshDNnnRdDGRwHcR4BaENKiDXFCy2Pi2vHJB5xU"); // Your wallet
    const [portfolioPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("portfolio"), exampleUserPubkey.toBuffer()],
        programId
    );
    console.log("👤 Portfolio PDA (for wallet):", portfolioPda.toString());

    console.log("\n=== 🔍 How to View in Solana Explorer ===");
    console.log("1. Go to: https://explorer.solana.com/");
    console.log("2. Click the network dropdown (top right)");
    console.log("3. Select 'Custom RPC'");
    console.log("4. Enter: http://localhost:8899");
    console.log("5. Search for any address above!");
    console.log("\n=== 📋 Quick Explorer URLs ===");
    console.log("Program:", `https://explorer.solana.com/address/${programId.toString()}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`);
    console.log("Platform:", `https://explorer.solana.com/address/${platformPda.toString()}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`);
    console.log("Company:", `https://explorer.solana.com/address/${companyPda.toString()}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`);

    console.log("\n⚠️  Note: Make sure your local validator is running on port 8899!");
}

getImportantAddresses().catch(console.error);

getImportantAddresses().catch(console.error);