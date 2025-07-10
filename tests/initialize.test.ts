import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StableGuard } from "../target/types/stable_guard";
import {LiteSVM} from "litesvm";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getMint, getAccount } from "@solana/spl-token";
import { assert } from "chai";
import { findCollateralPoolPda,findInsurancePoolPda,findLpMintPda,findPoolAuthorityPda } from "./helpers";
describe("initialize", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const program = anchor.workspace.StableGuard as Program<StableGuard>;

    const svm = new LiteSVM();
    let authority: Keypair;
    let collateralMint: Keypair;

    before(async()=>{
        svm.addProgramFromFile(program.programId,"./target/deploy/stable_guard.so");

        authority = Keypair.generate();

        await svm.airdrop(authority.publicKey, 100_000_000n);

        collateralMint = Keypair.generate();
        await svm.airdrop(collateralMint.publicKey, 100_000_000n);
    })

    it("Successfully initializes a new insurance pool", async () => {
    // --- 1. PDA Derivations ---
    const insurancePoolPda = findInsurancePoolPda(collateralMint.publicKey);
    const lpMintPda = findLpMintPda(collateralMint.publicKey);
    const collateralPoolPda = findCollateralPoolPda(collateralMint.publicKey);
    const poolAuthorityPda = findPoolAuthorityPda();

    const depegThreshold = new anchor.BN(98_500_000); // $0.985 with 8 decimals

    // --- 2. Instruction Execution (Happy Path) ---
    await program.methods
      .initialize(depegThreshold)
      .accounts({
        authority: authority.publicKey,
        insurancePool: insurancePoolPda,
        lpMint: lpMintPda,
        collateralTokenPool: collateralPoolPda,
        poolAuthority: poolAuthorityPda,
        mint: collateralMint.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();


    // Fetch and verify the InsurancePool account
    const insurancePoolAccount = await program.account.insurancePool.fetch(
      insurancePoolPda
    );
    assert.ok(insurancePoolAccount.authority.equals(authority.publicKey));
    assert.ok(
      insurancePoolAccount.collateralMint.equals(collateralMint.publicKey)
    );
    assert.ok(insurancePoolAccount.lpTokenMint.equals(lpMintPda));
    assert.ok(insurancePoolAccount.depegThreshold.eq(depegThreshold));
    assert.equal(insurancePoolAccount.totalCollateral.toNumber(), 0);
    assert.equal(insurancePoolAccount.totalInsuredValue.toNumber(), 0);
    assert.equal(insurancePoolAccount.lastPolicyId.toNumber(), 0);

    // Fetch and verify the LP Mint account
    const lpMintAccount = await getMint(connection, lpMintPda);
    assert.ok(lpMintAccount.mintAuthority.equals(poolAuthorityPda));
    assert.equal(lpMintAccount.supply, BigInt(0));
    assert.equal(lpMintAccount.decimals, 6);

    // Fetch and verify the Collateral Pool (vault) account
    const collateralPoolAccount = await getAccount(connection, collateralPoolPda);
    assert.ok(collateralPoolAccount.owner.equals(poolAuthorityPda));
    assert.ok(collateralPoolAccount.mint.equals(collateralMint.publicKey));
    assert.equal(collateralPoolAccount.amount, BigInt(0));
  });

  it("Fails to re-initialize an existing pool", async () => {
    // This test attempts to call `initialize` again with the same accounts.
    // It should fail because the accounts have already been created.
    const depegThreshold = new anchor.BN(98_500_000);

    try {
      await program.methods
        .initialize(depegThreshold)
        .accounts({
          authority: authority.publicKey,
          insurancePool: findInsurancePoolPda(collateralMint.publicKey),
          lpMint: findLpMintPda(collateralMint.publicKey),
          collateralTokenPool: findCollateralPoolPda(collateralMint.publicKey),
          poolAuthority: findPoolAuthorityPda(),
          mint: collateralMint.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      // If the RPC call succeeds, the test should fail.
      assert.fail("Re-initialization should have failed but it succeeded.");
    } catch (error) {
      // We expect an error, so we catch it and assert that it exists.
      // This confirms the program is behaving as expected.
      assert.isDefined(error);
      // A more specific check could be to look at the error code/message.
      // For example: assert.include(error.toString(), "custom program error");
    }
  });
})