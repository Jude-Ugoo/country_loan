import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CountryLoan } from "../target/types/country_loan";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert, expect } from "chai";
import * as spl from "@solana/spl-token";

describe("country_loan", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CountryLoan as Program<CountryLoan>;

  // Generate keys for admin, token mint, vault, and price feed
  const user = provider.wallet.publicKey;
  const tokenMint = Keypair.generate().publicKey;
  const vaultAddress = Keypair.generate().publicKey;
  const priceFeed = Keypair.generate().publicKey; // Simulated Pyth price feed PDA


  it("Initializes the protocol config", async () => {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Initialize ProtocolConfig first (required for admin check)
    const tx = await program.methods
      .initializeConfig(
        new anchor.BN(300), // Intrest_rate_3.00%
        new anchor.BN(8000), // Liquidation_threshold_80.00%
        new anchor.BN(10800) // Price_stale_threshold
      )
      .accounts({
        // protocolConfig: configPda,
        admin: provider.wallet.publicKey,
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

  it("Initializes the user account PDA", async () => {
    // Generate the user account PDA
    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.toBuffer()],
      program.programId
    );

    // Call initialize user account
    const tx = await program.methods
      .initUser()
      .accounts({
        // userAccount: userAccountPda,
        user,
        // systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch the user account
    const account = await program.account.userAccount.fetch(userAccountPda);

    expect(account.owner.toBase58()).to.equal(user.toBase58());
    expect(account.totalCollateralUsd.toNumber()).to.equal(0);
    expect(account.totalDebtUsd.toNumber()).to.equal(0);
  });

  it("Registers WETH token metadata", async () => {
    // Generate PDA for collateral vault
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), user.toBuffer(), tokenMint.toBuffer()],
      program.programId
    );

    // Call register_token
    await program.methods
      .registerToken(vaultAddress, tokenMint, priceFeed)
      .accounts({
        // collateralVault: vaultPda,
        // protocolConfig: configPda,
        // admin: admin.publicKey,
        vaultAddress,
        tokenMint,
        priceFeed,
        // systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch the CollateralVault account
    const collateralVault = await program.account.collateralVault.fetch(
      vaultPda
    );

   // Compare the actual values with the input values
    expect(collateralVault.tokenMint.toBase58()).to.equal(tokenMint.toBase58());
    expect(collateralVault.vaultAddress.toBase58()).to.equal(
      vaultAddress.toBase58()
    );
    expect(collateralVault.priceFeed.toBase58()).to.equal(priceFeed.toBase58());
  });


































  //   it("Initializes the vault WETH", async () => {
  //     const [vaultPda] = PublicKey.findProgramAddressSync(
  //       [Buffer.from("vault"), user.toBuffer(), wethMint.publicKey.toBuffer()],
  //       program.programId
  //     );

  //     const tokenAccount = spl.getAssociatedTokenAddressSync(
  //       wethMint.publicKey,
  //       vaultPda,
  //       true,
  //       spl.TOKEN_PROGRAM_ID
  //     );

  //     const tx = await program.methods
  //       .initVault()
  //       .accounts({
  //         payer: user,
  //         vault: vaultPda,
  //         tokenMint: wethMint.publicKey,
  //         oracleAddress: fakeOracle.publicKey,
  //         tokenAccount,
  //         associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
  //         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       })
  //       .signers([])
  //       .rpc();

  //     const vault = await program.account.vault.fetch(vaultPda);

  //     expect(vault.tokenMint.toBase58()).to.equal(wethMint.publicKey.toBase58());
  //     expect(vault.tokenAccount.toBase58()).to.equal(tokenAccount.toBase58());
  //     // expect(vault.bump).to.equal(0);
  //   });
});
