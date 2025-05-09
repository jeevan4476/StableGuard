import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { StableGuard } from "../target/types/stable_guard";
import {
  TOKEN_PROGRAM_ID,
  getMint,
  getAccount,
  createMint as splCreateMint,
  getOrCreateAssociatedTokenAccount,
  mintTo as splMintTo,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert } from "chai";

// Helper Function 
async function airdropSol(
  provider: anchor.AnchorProvider,
  targetPublicKey: PublicKey,
  lamports: number = 2 * LAMPORTS_PER_SOL
): Promise<string> {
  // console.log(`Airdropping ${lamports / LAMPORTS_PER_SOL} SOL to ${targetPublicKey.toBase58()}...`);
  try {
    const signature = await provider.connection.requestAirdrop(targetPublicKey, lamports);
    const latestBlockHash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: signature,
    }, "confirmed");
    return signature;
  } catch (error) {
    console.warn(`Airdrop to ${targetPublicKey.toBase58()} failed. They might already have funds or be rate-limited. Error: ${error.message}`);
    return "";
  }
}

// --- Constants ---
const LP_MINT_SEED_BUF = Buffer.from("lp_mint");
const POOL_SEED_BUF = Buffer.from("collateral_pool");
const AUTHORITY_SEED_BUF = Buffer.from("pool_authority");
const POLICY_SEED_BUF = Buffer.from("policy");

const USDC_DECIMALS = 6;
const PREMIUM_RATE_BPS_VAL = 50;
const BINARY_PAYOUT_BPS_VAL = 1000;
const POLICY_TERM_SECONDS = 7 * 24 * 60 * 60;

const MAINNET_USDC_MINT_PUBKEY = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const MAINNET_USDT_MINT_PUBKEY = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

describe("StableGuard Protocol Full Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const program = anchor.workspace.StableGuard as Program<StableGuard>;

  let authoritySigner: Keypair;
  let buyer: Keypair;

  let testUsdcMintKeypair: Keypair;
  let testUsdcMintPublicKey: PublicKey;

  let poolAuthorityPda: PublicKey;
  let lpMintPda: PublicKey;
  let collateralPoolUsdcAccountPda: PublicKey;

  let buyerTestUsdcAta: PublicKey;
  let policyIdCounter = 0;

  before(async () => {
    console.log("--- Global Test Setup for All Tests ---");
    authoritySigner = (provider.wallet as anchor.Wallet).payer;
    buyer = Keypair.generate();

    await airdropSol(provider, buyer.publicKey);

    testUsdcMintKeypair = Keypair.generate();
    testUsdcMintPublicKey = await splCreateMint(
      provider.connection, authoritySigner, authoritySigner.publicKey, null, USDC_DECIMALS, testUsdcMintKeypair
    );
    console.log(`Test USDC Mint (for collateral/premiums) created: ${testUsdcMintPublicKey.toBase58()}`);

    [poolAuthorityPda] = PublicKey.findProgramAddressSync([AUTHORITY_SEED_BUF], program.programId);
    [lpMintPda] = PublicKey.findProgramAddressSync([LP_MINT_SEED_BUF], program.programId);
    [collateralPoolUsdcAccountPda] = PublicKey.findProgramAddressSync(
      [POOL_SEED_BUF, testUsdcMintPublicKey.toBuffer()], program.programId
    );
    console.log("Core PDAs derived.");
    console.log("--- Global Test Setup Complete ---\n");
  });

  describe("Initialize Instruction", () => {
    it("should initialize the protocol correctly", async () => {
      console.log("\nCalling 'initialize' instruction...");
      await program.methods
        .initialize() // Using confirmed working name
        .accounts({
          authority: authoritySigner.publicKey,
          lpMint: lpMintPda,
          collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
          poolAuthority: poolAuthorityPda,
          usdcMint: testUsdcMintPublicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      console.log("'initialize' instruction successful.");

      const lpMintInfo = await getMint(provider.connection, lpMintPda);
      assert.strictEqual(lpMintInfo.mintAuthority.toBase58(), poolAuthorityPda.toBase58());
      assert.strictEqual(lpMintInfo.decimals, USDC_DECIMALS);
      assert.strictEqual(lpMintInfo.supply, BigInt(0));

      const collateralPoolInfo = await getAccount(provider.connection, collateralPoolUsdcAccountPda);
      assert.strictEqual(collateralPoolInfo.mint.toBase58(), testUsdcMintPublicKey.toBase58());
      assert.strictEqual(collateralPoolInfo.owner.toBase58(), poolAuthorityPda.toBase58());
      assert.strictEqual(collateralPoolInfo.amount, BigInt(0));
      console.log("Initialize Happy Path: Assertions passed!");
    });

    it("should fail to initialize if already initialized", async () => {
      console.log("\nAttempting to call 'initialize' again (should fail)...");
      try {
        await program.methods
          .initialize() // Using confirmed working name
          .accounts({
            authority: authoritySigner.publicKey,
            lpMint: lpMintPda,
            collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
            poolAuthority: poolAuthorityPda,
            usdcMint: testUsdcMintPublicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("Should have failed to re-initialize.");
      } catch (error) {
        assert.isNotNull(error);
        const errorString = error.toString();
        assert.isTrue(
          errorString.includes("custom program error: 0x0") ||
          errorString.toLowerCase().includes("already in use") ||
          errorString.toLowerCase().includes("already exists"),
          `Re-initialization error message mismatch: ${errorString}`
        );
        console.log("Re-initialization failed as expected.");
      }
    });
  });

  describe("Create Policy Instruction", () => {
    before(async () => {
      console.log("\nSetup for Create Policy Tests (Buyer ATA and Funds)");
      buyerTestUsdcAta = (await getOrCreateAssociatedTokenAccount(
        connection, authoritySigner, testUsdcMintPublicKey, buyer.publicKey
      )).address;

      await splMintTo(
        connection, authoritySigner, testUsdcMintPublicKey, buyerTestUsdcAta, authoritySigner,
        5000 * (10 ** USDC_DECIMALS)
      );
      console.log(`Minted 5000 test USDC to buyer's ATA: ${buyerTestUsdcAta.toBase58()}`);
      console.log(" Create Policy Setup Complete\n");
    });

    it("should successfully create a policy for USDC depeg protection", async () => {
      policyIdCounter++;
      const currentPolicyId = new BN(policyIdCounter);
      const insuredAmountLamports = new BN(100 * (10 ** USDC_DECIMALS));
      const insuredStablecoinMintKey = MAINNET_USDC_MINT_PUBKEY;

      const expectedPremiumLamports = insuredAmountLamports.mul(new BN(PREMIUM_RATE_BPS_VAL)).div(new BN(10000));
      const [policyAccountPda, policyAccountBump] = PublicKey.findProgramAddressSync(
        [POLICY_SEED_BUF, buyer.publicKey.toBuffer(), currentPolicyId.toBuffer("le", 8)],
        program.programId
      );

      const buyerInitialBalance = (await getAccount(connection, buyerTestUsdcAta)).amount;
      const poolInitialBalance = (await getAccount(connection, collateralPoolUsdcAccountPda)).amount;

      console.log(`\nCalling 'createPolicy' for USDC policy (ID: ${currentPolicyId})...`);
      await program.methods
        .createPolicy(insuredAmountLamports, currentPolicyId)
        .accounts({
          buyer: buyer.publicKey,
          policyAccount: policyAccountPda,
          buyerUsdcAccount: buyerTestUsdcAta,
          collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
          usdcMint: testUsdcMintPublicKey,
          insuredStablecoinMint: insuredStablecoinMintKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([buyer])
        .rpc();
      console.log("'createPolicy' for USDC policy RPC successful.");

      const policyAccountInfo = await program.account.policyAccount.fetch(policyAccountPda);
      assert.strictEqual(policyAccountInfo.buyer.toBase58(), buyer.publicKey.toBase58());
      assert.ok(policyAccountInfo.policyId.eq(currentPolicyId));
      assert.strictEqual(policyAccountInfo.insuredStablecoinMint.toBase58(), insuredStablecoinMintKey.toBase58());
      assert.ok(policyAccountInfo.insuredAmount.eq(insuredAmountLamports));
      assert.ok(policyAccountInfo.premiumPaid.eq(expectedPremiumLamports));
      const expectedPayoutLamports = insuredAmountLamports.mul(new BN(BINARY_PAYOUT_BPS_VAL)).div(new BN(10000));
      assert.ok(policyAccountInfo.payoutAmount.eq(expectedPayoutLamports));
      assert.isTrue(policyAccountInfo.startTimestamp.gtn(0));
      assert.isTrue(policyAccountInfo.expiryTimestamp.eq(policyAccountInfo.startTimestamp.add(new BN(POLICY_TERM_SECONDS))));
      assert.deepStrictEqual(policyAccountInfo.status, { active: {} });
      assert.strictEqual(policyAccountInfo.bump, policyAccountBump);

      const buyerFinalBalance = (await getAccount(connection, buyerTestUsdcAta)).amount;
      const poolFinalBalance = (await getAccount(connection, collateralPoolUsdcAccountPda)).amount;
      assert.strictEqual(BigInt(buyerInitialBalance.toString()) - BigInt(buyerFinalBalance.toString()), BigInt(expectedPremiumLamports.toString()));
      assert.strictEqual(BigInt(poolFinalBalance.toString()) - BigInt(poolInitialBalance.toString()), BigInt(expectedPremiumLamports.toString()));
      console.log("USDC Policy Creation: Assertions passed!");
    });

    // it("should successfully create a policy for USDT depeg protection", async () => {
    //   policyIdCounter++;
    //   const currentPolicyId = new BN(policyIdCounter);
    //   const insuredAmountLamports = new BN(200 * (10 ** USDC_DECIMALS));
    //   const insuredStablecoinMintKey = MAINNET_USDT_MINT_PUBKEY;

    //   const expectedPremiumLamports = insuredAmountLamports.mul(new BN(PREMIUM_RATE_BPS_VAL)).div(new BN(10000));
    //   const [policyAccountPda, policyAccountBump] = PublicKey.findProgramAddressSync(
    //     [POLICY_SEED_BUF, buyer.publicKey.toBuffer(), currentPolicyId.toBuffer("le", 8)],
    //     program.programId
    //   );

    //   console.log(`\nCalling 'createPolicy' for USDT policy (ID: ${currentPolicyId})...`);
    //   await program.methods
    //     .createPolicy(insuredAmountLamports, currentPolicyId) // Using confirmed working name
    //     .accounts({
    //       buyer: buyer.publicKey,
    //       policyAccount: policyAccountPda,
    //       buyerUsdcAccount: buyerTestUsdcAta,
    //       collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
    //       usdcMint: testUsdcMintPublicKey,
    //       insuredStablecoinMint: insuredStablecoinMintKey,
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //       systemProgram: SystemProgram.programId,
    //       clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //     })
    //     .signers([buyer])
    //     .rpc();
    //   console.log("'createPolicy' for USDT policy RPC successful.");

    //   const policyAccountInfo = await program.account.policyAccount.fetch(policyAccountPda);
    //   assert.strictEqual(policyAccountInfo.buyer.toBase58(), buyer.publicKey.toBase58());
    //   assert.ok(policyAccountInfo.policyId.eq(currentPolicyId));
    //   assert.strictEqual(policyAccountInfo.insuredStablecoinMint.toBase58(), insuredStablecoinMintKey.toBase58());
    //   assert.ok(policyAccountInfo.premiumPaid.eq(expectedPremiumLamports));
    //   console.log("USDT Policy Creation: Assertions passed!");
    // });

    it("should fail to create a policy for an unsupported stablecoin", async () => {
      policyIdCounter++;
      const currentPolicyId = new BN(policyIdCounter);
      const insuredAmountLamports = new BN(50 * (10 ** USDC_DECIMALS));
      const unsupportedTestMintKeypair = Keypair.generate();
      const unsupportedTestMintPublicKey = await splCreateMint(
        provider.connection, authoritySigner, authoritySigner.publicKey, null, USDC_DECIMALS, unsupportedTestMintKeypair
      );
      const [policyAccountPda] = PublicKey.findProgramAddressSync(
        [POLICY_SEED_BUF, buyer.publicKey.toBuffer(), currentPolicyId.toBuffer("le", 8)],
        program.programId
      );

      console.log(`\nCalling 'createPolicy' with unsupported mint (should fail)...`);
      try {
        await program.methods
          .createPolicy(insuredAmountLamports, currentPolicyId)
          .accounts({
            buyer: buyer.publicKey,
            policyAccount: policyAccountPda,
            buyerUsdcAccount: buyerTestUsdcAta,
            collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
            usdcMint: testUsdcMintPublicKey,
            insuredStablecoinMint: unsupportedTestMintPublicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Should have failed due to unsupported stablecoin.");
      } catch (error) {
        assert.isNotNull(error);
        assert.include(error.toString(), "UnsupportedStablecoinMint");
        console.log("Failed with unsupported stablecoin as expected.");
      }
    });

    it("should fail to create a policy if buyer has insufficient USDC for premium", async () => {
      policyIdCounter++;
      const currentPolicyId = new BN(policyIdCounter);

      // Buyer's current balance is 5000 * (10 ** USDC_DECIMALS)
      const buyerCurrentBalanceLamports = (await getAccount(connection, buyerTestUsdcAta)).amount;
      console.log(`Buyer current balance for insufficient funds test: ${buyerCurrentBalanceLamports.toString()}`);

      // Calculate an insured amount whose premium will *exceed* the buyer's current balance
      // Premium = InsuredAmount * (PREMIUM_RATE_BPS_VAL / 10000)
      // InsuredAmount = Premium * (10000 / PREMIUM_RATE_BPS_VAL)
      // Let's set premium to be buyerCurrentBalanceLamports + 1 (lamport)
      const desiredPremiumExceedingBalance = new BN(buyerCurrentBalanceLamports.toString()).add(new BN(1));
      const insuredAmountToTriggerFailure = desiredPremiumExceedingBalance
        .mul(new BN(10000))
        .div(new BN(PREMIUM_RATE_BPS_VAL));

      // Recalculate the actual premium for this amount to be precise
      const actualCalculatedPremium = insuredAmountToTriggerFailure
        .mul(new BN(PREMIUM_RATE_BPS_VAL))
        .div(new BN(10000));

      console.log(`Desired premium to exceed balance: ${desiredPremiumExceedingBalance.toString()}`);
      console.log(`Calculated insured amount for this: ${insuredAmountToTriggerFailure.toString()}`);
      console.log(`Actual premium for this insured amount: ${actualCalculatedPremium.toString()}`);
      // Ensure actual premium is indeed > buyer's balance
      assert.isTrue(actualCalculatedPremium.gt(new BN(buyerCurrentBalanceLamports.toString())), "Test setup error: Calculated premium is not greater than buyer's balance.");


      const insuredStablecoinMintKey = MAINNET_USDC_MINT_PUBKEY;

      const [policyAccountPda] = PublicKey.findProgramAddressSync(
        [POLICY_SEED_BUF, buyer.publicKey.toBuffer(), currentPolicyId.toBuffer("le", 8)],
        program.programId
      );

      console.log(`\nCalling '${program.methods.createPolicy.name}' with premium > balance (should fail)...`);

      try {
        await program.methods
          .createPolicy(insuredAmountToTriggerFailure, currentPolicyId)
          .accounts({
            buyer: buyer.publicKey,
            policyAccount: policyAccountPda,
            buyerUsdcAccount: buyerTestUsdcAta,
            collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
            usdcMint: testUsdcMintPublicKey,
            insuredStablecoinMint: insuredStablecoinMintKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Transaction should have failed due to insufficient funds for premium.");
      } catch (error) {
        assert.isNotNull(error, "Error was expected due to insufficient funds.");
        // console.log("Insufficient funds raw error:", JSON.stringify(error, null, 2));
        // console.log("Insufficient funds error logs:", error.logs);

        // SPL Token program error 0x1 (InsufficientFunds) often appears in logs as "custom program error: 0x1"
        // when the failed instruction is an SPL token instruction.
        // Anchor might wrap this. Check error.message, error.msg, or error.logs.
        const errorString = error.toString().toLowerCase();
        const logsString = error.logs ? error.logs.join(' ').toLowerCase() : "";

        const hasInsufficientFundsInLogs = logsString.includes("insufficient funds") ||
          (logsString.includes("spl_token") && logsString.includes("custom program error: 0x1"));

        const hasTransferFailedError = errorString.includes("insufficient funds") ||
          errorString.includes("failed to transfer") ||
          errorString.includes("0x1"); // Error code for InsufficientFunds in SPL Token

        assert.isTrue(
          hasInsufficientFundsInLogs || hasTransferFailedError,
          `Error message/logs did not clearly indicate insufficient funds. Error: ${error.toString()}, Logs: ${error.logs ? error.logs.join(", ") : "N/A"}`
        );
        console.log("Failed with insufficient funds as expected.");
      }
    });

    it("should fail to create a policy with a duplicate policy_id for the same buyer", async () => {
      const firstPolicyIdUsedByBuyer = new BN(1); // Assumes first test used ID 1
      const insuredAmountLamports = new BN(10 * (10 ** USDC_DECIMALS));
      const insuredStablecoinMintKey = MAINNET_USDC_MINT_PUBKEY;

      const [policyAccountPda] = PublicKey.findProgramAddressSync(
        [POLICY_SEED_BUF, buyer.publicKey.toBuffer(), firstPolicyIdUsedByBuyer.toBuffer("le", 8)],
        program.programId // This PDA would already exist from the first test
      );

      console.log(`\nCalling 'createPolicy' with duplicate policy ID ${firstPolicyIdUsedByBuyer} (should fail)...`);
      try {
        await program.methods
          .createPolicy(insuredAmountLamports, firstPolicyIdUsedByBuyer)
          .accounts({
            buyer: buyer.publicKey,
            policyAccount: policyAccountPda,
            buyerUsdcAccount: buyerTestUsdcAta,
            collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
            usdcMint: testUsdcMintPublicKey,
            insuredStablecoinMint: insuredStablecoinMintKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Transaction should have failed due to duplicate policy ID.");
      } catch (error) {
        assert.isNotNull(error);
        const errorString = error.toString();
        assert.isTrue(
          errorString.includes("custom program error: 0x0") ||
          errorString.toLowerCase().includes("already in use"),
          `Duplicate policy ID error message mismatch: ${errorString}`
        );
        console.log("Failed with duplicate policy ID as expected.");
      }
    });

  });

}); 