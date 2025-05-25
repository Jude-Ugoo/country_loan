import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CountryLoan } from "../target/types/country_loan";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import * as spl from "@solana/spl-token";

describe("country_loan", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CountryLoan as Program<CountryLoan>;

  const user = provider.wallet.publicKey;
  let wethMint: anchor.web3.Keypair; // Simulate supported token mint (WETH) — you should replace this with real mint if available
  let testWethMint: anchor.web3.Keypair;
  const fakeOracle = Keypair.generate();

  before(async () => {
    // Create dummy WETH mint
    wethMint = anchor.web3.Keypair.generate();
    testWethMint = anchor.web3.Keypair.generate();

    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(82);
    const tx = new anchor.web3.Transaction();

    tx.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: user,
        newAccountPubkey: wethMint.publicKey,
        space: 82,
        lamports,
        programId: anchor.utils.token.TOKEN_PROGRAM_ID,
      }),
      spl.createInitializeMintInstruction(
        wethMint.publicKey,
        6,
        provider.wallet.publicKey,
        null
      )
    );

    tx.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: user,
        newAccountPubkey: testWethMint.publicKey,
        space: 82,
        lamports,
        programId: anchor.utils.token.TOKEN_PROGRAM_ID,
      }),
      spl.createInitializeMintInstruction(
        testWethMint.publicKey,
        6,
        provider.wallet.publicKey,
        null
      )
    );

    const txSig = await provider.sendAndConfirm(tx, [wethMint, testWethMint]);
    console.log("WETH mint created:", wethMint.publicKey.toBase58());
    console.log("Test WETH mint created:", testWethMint.publicKey.toBase58());
    console.log("Transaction signature:", txSig);
  });

  it("Initializes the protocol config", async () => {
    const [configPda] = PublicKey.findProgramAddressSync(
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
        protocolConfig: configPda,
        admin: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
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
        userAccount: userAccountPda,
        user,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch the user account
    const account = await program.account.userAccount.fetch(userAccountPda);

    expect(account.owner.toBase58()).to.equal(user.toBase58());
    expect(account.totalCollateralUsd.toNumber()).to.equal(0);
    expect(account.totalDebtUsd.toNumber()).to.equal(0);
  });

  it("Initializes the vault WETH", async () => {
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), user.toBuffer(), wethMint.publicKey.toBuffer()],
      program.programId
    );

    const tokenAccount = spl.getAssociatedTokenAddressSync(
      wethMint.publicKey,
      vaultPda,
      true,
      spl.TOKEN_PROGRAM_ID
    );

    const tx = await program.methods
      .initVault()
      .accounts({
        payer: user,
        vault: vaultPda,
        tokenMint: wethMint.publicKey,
        oracleAddress: fakeOracle.publicKey,
        tokenAccount,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);

    expect(vault.tokenMint.toBase58()).to.equal(wethMint.publicKey.toBase58());
    expect(vault.tokenAccount.toBase58()).to.equal(tokenAccount.toBase58());
    // expect(vault.bump).to.equal(0);
  });

//   it("Initializes the vault with oracle address", async () => {
//     const [vaultPda] = PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("vault"),
//         user.toBuffer(),
//         testWethMint.publicKey.toBuffer(),
//       ],
//       program.programId
//     );

//     const tokenAccount = spl.getAssociatedTokenAddressSync(
//       testWethMint.publicKey,
//       vaultPda,
//       true,
//       spl.TOKEN_PROGRAM_ID
//     );

//     const tx = await program.methods
//       .initVault()
//       .accounts({
//         payer: user,
//         vault: vaultPda,
//         tokenMint: testWethMint.publicKey,
//         oracleAddress: fakeOracle.publicKey,
//         tokenAccount,
//         associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//         systemProgram: anchor.web3.SystemProgram.programId,
//         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//       })
//       .signers([])
//       .rpc();

//     const vaultAccount = await program.account.vault.fetch(vaultPda);

//     expect(vaultAccount.tokenMint.toBase58()).to.equal(
//       testWethMint.publicKey.toBase58()
//     );
//     expect(vaultAccount.tokenAccount.toBase58()).to.equal(
//       tokenAccount.toBase58()
//     );
//     expect(vaultAccount.oracleAddress.toBase58()).to.equal(
//       fakeOracle.publicKey.toBase58()
//     );
//   });
});
