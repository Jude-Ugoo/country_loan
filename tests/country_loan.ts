import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CountryLoan } from "../target/types/country_loan";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("country_loan", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CountryLoan as Program<CountryLoan>;

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
    const user = provider.wallet.publicKey;

    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .initUser()
      .accounts({
        userAccount: userAccountPda,
        user,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.userAccount.fetch(userAccountPda);

    expect(account.owner.toBase58()).to.equal(user.toBase58());
    expect(account.totalCollateralUsd.toNumber()).to.equal(0);
    expect(account.totalDebtUsd.toNumber()).to.equal(0);
  });
});
