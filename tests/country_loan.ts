import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CountryLoan } from "../target/types/country_loan";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { assert, expect } from "chai";
import * as spl from "@solana/spl-token";

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
});
