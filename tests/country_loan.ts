import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CountryLoan } from "../target/types/country_loan";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert, expect } from "chai";
import * as spl from "@solana/spl-token";

// Constants for mocking PriceUpdateV2 account
const PYTH_MAGIC = 0xd1ce; // Magic number for PriceUpdateV2
const PYTH_VERSION = 2; // Version
const PYTH_ATYPE = 0; // Account type
const PYTH_PRICE = 200000; // $2000 in cents (WETH/USD, expo -2)
const PYTH_EXPO = -2; // Exponent for price (cents)
const PYTH_CONF = 1000; // Confidence interval
const WETH_FEED_ID = Buffer.from(
  "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "hex"
); // WETH/USD feed ID

describe("country_loan", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CountryLoan as Program<CountryLoan>;
  const connecton = provider.connection;

  // Generate keys for admin, token mint, vault, and price feed
  const admin = provider.wallet;
  const user = Keypair.generate();
  const tokenMint = Keypair.generate().publicKey;
  //   const vaultAddress = Keypair.generate().publicKey;
  const priceFeed = Keypair.generate().publicKey;

  const depositAmount = 100_000_000;

  let wethMint: PublicKey;
  let userTokenAccount: PublicKey;
  let vaultTokenAccount: PublicKey;
  let configPda: PublicKey;
  let vaultPda: PublicKey;
  let userAccountPda: PublicKey;

  before(async () => {
    // Airdrop SOL to user for account creation
    await connecton.requestAirdrop(user.publicKey, 2_000_000_000);
    await connecton.requestAirdrop(admin.publicKey, 2_000_000_000);
    let balance = await connecton.getBalance(user.publicKey);
    while (balance < 2_000_000_000) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      balance = await connecton.getBalance(user.publicKey);
    }

    // Create WETH mint
    wethMint = await spl.createMint(
      connecton,
      admin.payer,
      admin.publicKey,
      null,
      9
    );

    // Create user token account
    userTokenAccount = await spl.createAccount(
      connecton,
      user,
      wethMint,
      user.publicKey
    );

    vaultTokenAccount = await spl.createAccount(
      connecton,
      admin.payer,
      wethMint,
      admin.publicKey
    );

    // Mint WETH to user
    await spl.mintTo(
      connecton,
      admin.payer,
      wethMint,
      userTokenAccount,
      admin.payer,
      depositAmount
    );
  });

  it("Initializes the protocol config", async () => {
    // Initialize ProtocolConfig first (required for admin check)
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    const tx = await program.methods
      .initializeConfig(
        new anchor.BN(300), // Intrest_rate_3.00%
        new anchor.BN(8000), // Liquidation_threshold_80.00%
        new anchor.BN(10800) // Price_stale_threshold
      )
      .accounts({
        // protocolConfig: configPda,
        admin: admin.publicKey,
        // systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.protocolConfig.fetch(configPda);

    expect(config.intrestRateBps.toNumber()).to.equal(300);
    expect(config.liquidationThresholdBps.toNumber()).to.equal(8000);
    expect(config.priceStaleThreshold.toNumber()).to.equal(10800);
    expect(config.admin.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58()
    );
  });

  it("Initializes the user account PDA for Admin", async () => {
    const [adminAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), admin.publicKey.toBuffer()],
      program.programId
    );

    // Call initialize user account
    try {
      await program.methods
        .initUser()
        .accounts({
          userAccount: adminAccountPda,
          user: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      const adminAccountBefore = await program.account.userAccount.fetch(
        adminAccountPda
      );
      console.log("Admin account initialized successfully");
      console.log("Admin account owner:", adminAccountBefore.owner.toBase58());
      console.log(
        "Initial token balances:",
        adminAccountBefore.tokenBalances.map((b) => b.toNumber())
      );
      console.log("Has active loan:", adminAccountBefore.hasActiveLoan);
    } catch (error) {
      console.error("InitUser failed:", error);
      throw error;
    }

    // Fetch the user account
    const adminAccount = await program.account.userAccount.fetch(
      adminAccountPda
    );

    expect(adminAccount.owner.toBase58()).to.equal(admin.publicKey.toBase58());
    adminAccount.tokenBalances.forEach((balance, index) => {
      expect(balance.toNumber()).to.equal(
        0,
        `tokenBalances[${index}] should be 0`
      );
    });
    expect(adminAccount.hasActiveLoan).to.equal(false);
  });

  it("Registers WETH token metadata", async () => {
    // Generate PDA for collateral vault
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), admin.publicKey.toBuffer(), wethMint.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .registerToken(vaultTokenAccount, tokenMint, priceFeed)
        .accounts({
          collateralVault: vaultPda,
          protocolConfig: configPda,
          admin: admin.publicKey,
          vaultAddress: vaultTokenAccount,
          tokenMint: wethMint,
          priceFeed,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (error) {
      console.error("RegisterToken failed:", error);
      throw error;
    }

    // Fetch the CollateralVault account
    const collateralVault = await program.account.collateralVault.fetch(
      vaultPda
    );

    // Compare the actual values with the input values
    expect(collateralVault.tokenMint.toBase58()).to.equal(tokenMint.toBase58());
    expect(collateralVault.vaultAddress.toBase58()).to.equal(
      vaultTokenAccount.toBase58()
    );
    expect(collateralVault.priceFeed.toBase58()).to.equal(priceFeed.toBase58());
  });

  it("Deposits WETH to vault and updates UserAccount", async () => {
    //========================== Initialize ProtocolConfig first (required for admin check) ======================

    //===========================================================================================================

    //==================================== Initialize user account PDA for `user` =================================
    [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.publicKey.toBuffer()],
      program.programId
    );

    // Call initialize user account
    try {
      await program.methods
        .initUser()
        .accounts({
          userAccount: userAccountPda,
          user: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Verify user account initialization
      const userAccountBefore = await program.account.userAccount.fetch(
        userAccountPda
      );
      console.log("\nUser account initialized successfully");
      console.log("User account owner:", userAccountBefore.owner.toBase58());
      console.log(
        "Initial token balances:",
        userAccountBefore.tokenBalances.map((b) => b.toNumber())
      );
      console.log("Has active loan:", userAccountBefore.hasActiveLoan);
    } catch (error) {
      console.error("InitUser failed:", error);
      throw error;
    }
    //============================================================================================================

    //======================================== Generate PDA for collateral vault ===================================
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), admin.publicKey.toBuffer(), wethMint.toBuffer()],
      program.programId
    );

    await program.methods
      .registerToken(vaultTokenAccount, tokenMint, priceFeed)
      .accounts({
        collateralVault: vaultPda,
        protocolConfig: configPda,
        admin: admin.publicKey,
        vaultAddress: vaultTokenAccount,
        tokenMint: wethMint,
        priceFeed,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch the CollateralVault account
    const collateralVault = await program.account.collateralVault.fetch(
      vaultPda
    );

    // Compare the actual values with the input values
    expect(collateralVault.tokenMint.toBase58()).to.equal(tokenMint.toBase58());
    expect(collateralVault.vaultAddress.toBase58()).to.equal(
      vaultTokenAccount.toBase58()
    );
    expect(collateralVault.priceFeed.toBase58()).to.equal(priceFeed.toBase58());
    //=================================================================================================================

    //================================================= Call Deposit ==================================================
    const tokenIndex = 0; // WETH at index 0
    const userAccountBefore = await program.account.userAccount.fetch(
      userAccountPda
    );

    console.log("\nBefore deposit:");
    console.log(
      "User token account balance:",
      (await connecton.getTokenAccountBalance(userTokenAccount)).value.uiAmount
    );
    console.log(
      "Vault token account balance:",
      (await connecton.getTokenAccountBalance(vaultTokenAccount)).value.uiAmount
    );
    console.log(
      "User account token balances:",
      userAccountBefore.tokenBalances.map((b) => b.toNumber())
    );

    await program.methods
      .deposit(new anchor.BN(depositAmount), tokenIndex)
      .accounts({
        userAccount: userAccountPda,
        collateralVault: vaultPda,
        user: user.publicKey,
        admin: admin.publicKey,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenAccount,
        tokenMint: wethMint,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    // Fetch accounts
    const vaultBalance = (
      await connecton.getTokenAccountBalance(vaultTokenAccount)
    ).value.uiAmount;
    const userAccount = await program.account.userAccount.fetch(userAccountPda);

    console.log("\nAfter deposit:");
    console.log(
      "User token account balance:",
      (await connecton.getTokenAccountBalance(userTokenAccount)).value.uiAmount
    );
    console.log("Vault token account balance:", vaultBalance);
    console.log(
      "User account token balances:",
      userAccount.tokenBalances.map((b) => b.toNumber())
    );
    console.log("Deposit amount:", depositAmount);
    console.log("Token index:", tokenIndex);

    // Assertions
    expect(vaultBalance).to.equal(depositAmount / 10 ** 9);
    expect(userAccount.tokenBalances[tokenIndex].toNumber()).to.equal(
      depositAmount
    );
    //========================================================================================================================
  });

  //========================================= FETCHES PRICE FROM PYTH FEED =======================================
  it("Fetches price from mock Pyth feed", async () => {
    // Generates a keypair for then mock price feed account
    const priceFeed = Keypair.generate();

    // Fetch the validator's clock to ensure the timestamp is fresh
    const slot = await connecton.getSlot();
    const slotTime = await connecton.getBlockTime(slot);
    const currentTimestamp = slotTime || Math.floor(Date.now() / 1000);

    // Mock Pyth price feed data
    const priceFeedData = Buffer.alloc(256); // Allocate enough space for the price account
    let offset = 0;

    // Write PriceUpdateV2 account data (simplified)
    priceFeedData.writeUInt8(0, offset); // writeable (false)
    offset += 1;
    priceFeedData.fill(0, offset, offset + 7); // _padding (7 bytes, all zeros)
    offset += 7; // Padding to align to 8 bytes
    priceFeedData.writeUInt32LE(PYTH_MAGIC, offset); // magic
    offset += 4;
    priceFeedData.writeUInt32LE(PYTH_VERSION, offset); // ver
    offset += 4;
    priceFeedData.writeUInt32LE(PYTH_ATYPE, offset); // atype
    offset += 4;
    priceFeedData.fill(0, offset, offset + 4); // _padding2 (4 bytes, all zeros)
    offset += 4; // Padding

    // Write PriceFeedMessage (price_message field)
    priceFeedData.set(WETH_FEED_ID, offset); // feed_id (32 bytes)
    offset += 32;
    priceFeedData.writeBigInt64LE(BigInt(PYTH_PRICE), offset); // price (i64)
    offset += 8;
    priceFeedData.writeBigUInt64LE(BigInt(PYTH_CONF), offset); // conf (u64)
    offset += 8;
    priceFeedData.writeInt32LE(PYTH_EXPO, offset); // exponent (i32)
    offset += 4;
    priceFeedData.fill(0, offset, offset + 4); // _padding (4 bytes, all zeros)
    offset += 4; // Padding
    // const currentTimestamp = Math.floor(Date.now() / 1000);
    priceFeedData.writeBigInt64LE(BigInt(currentTimestamp), offset); // publish_time (i64)
    offset += 8;
    priceFeedData.writeBigInt64LE(BigInt(currentTimestamp - 10), offset); // prev_publish_time (i64)
    offset += 8;

    // Additional fields that might be expected by PriceUpdateV2
    const dummySignature = Buffer.alloc(64, 0xaa); // 64 bytes for a dummy signature
    priceFeedData.set(dummySignature, offset); // signature (64 bytes)
    offset += 64;

    const dummyMerkleRoot = Buffer.alloc(32, 0xbb); // 32 bytes for a dummy Merkle root
    priceFeedData.set(dummyMerkleRoot, offset); // merkle_root (32 bytes)
    offset += 32;

    // Write price_update_data (Vec<u8>, add a dummy 32-byte proof)
    const dummyProof = Buffer.alloc(32, 0); // 32 bytes of zeros (dummy proof)
    priceFeedData.writeUInt32LE(dummyProof.length, offset); // Length of Vec<u8>
    offset += 4;
    priceFeedData.set(dummyProof, offset); // Write the dummy proof
    offset += dummyProof.length;

    // Create the price update account on-chain
    const lamports = await connecton.getMinimumBalanceForRentExemption(
      priceFeedData.length
    );
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: admin.publicKey,
      newAccountPubkey: priceFeed.publicKey,
      lamports,
      space: priceFeedData.length,
      programId: program.programId, // Owned by the program for simplicity
    });

    const tx = new anchor.web3.Transaction().add(createAccountIx);
    await provider.sendAndConfirm(tx, [priceFeed]);

    // Call fetch_price
    const price = await program.methods
      .fetchPrice()
      .accounts({
        priceUpdate: priceFeed.publicKey,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .rpc();

    console.log("Price:", price);

    // Assert the returned price matches the mocked price
    assert.strictEqual(
      new anchor.BN(price).toNumber(),
      PYTH_PRICE,
      "Fetched price does not match mocked price"
    );
  });
});
