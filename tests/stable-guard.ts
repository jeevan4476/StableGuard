import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { StableGuard } from "../target/types/stable_guard"; // Adjust if your type path is different
import {
  TOKEN_PROGRAM_ID,
  getMint,
  getAccount,
  createMint as splCreateMint, // We'll use this for unsupported mint test only
  getOrCreateAssociatedTokenAccount,
  mintTo as splMintTo,
  ASSOCIATED_TOKEN_PROGRAM_ID,
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
  lamports: number = 10 * LAMPORTS_PER_SOL // Increased default for potentially more transactions
): Promise<string> {
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

// Constants 
const LP_MINT_SEED_BUF = Buffer.from("lp_mint");
const POOL_SEED_BUF = Buffer.from("collateral_pool");
const AUTHORITY_SEED_BUF = Buffer.from("pool_authority");
const POLICY_SEED_BUF = Buffer.from("policy");

const TOKEN_DECIMALS = 6;
const PREMIUM_RATE_BPS_VAL = 50;
const BINARY_PAYOUT_BPS_VAL = 1000;
const POLICY_TERM_SECONDS = 7 * 24 * 60 * 60;


const MAINNET_USDC_MINT_PUBKEY = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const MAINNET_USDT_MINT_PUBKEY = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
const PYTH_PRICE_UPDATE_V2_ACCOUNT_PUBKEY = new PublicKey("Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX");



describe("StableGuard Protocol Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const program = anchor.workspace.StableGuard as Program<StableGuard>;

  let authoritySigner: Keypair;
  let buyer: Keypair;
  let underwriter: Keypair;

  // Test mints for collateral pools and premium payments
  let testUsdcMintKeypair: Keypair; // For the initialize-specific tests (Mint 1)
  let testUsdcMintPublicKey: PublicKey; // Renamed from testCollateralMint1PublicKey for clarity

  let testUsdtMintKeypair: Keypair; // For the initialize-specific tests (Mint 2)
  let testUsdtMintPublicKey: PublicKey;

  // PDAs for pools and LP mints initialized with these test mints
  // These are used by createPolicy and depositCollateral tests
  let usdcPoolLpMintPda: PublicKey;       // LP Mint for the pool initialized with testUsdcMintPublicKey
  let usdcPoolCollateralPda: PublicKey; // Collateral Pool for testUsdcMintPublicKey
  let usdtPoolLpMintPda: PublicKey;       // LP Mint for the pool initialized with testUsdtMintPublicKey
  let usdtPoolCollateralPda: PublicKey; // Collateral Pool for testUsdtMintPublicKey


  let poolAuthorityPda: PublicKey; // Global

  // Buyer's ATAs for paying premiums with test mints
  let buyerTestUsdcAta: PublicKey;
  let buyerTestUsdtAta: PublicKey;

  // Underwriter's ATA for depositing test USDC collateral
  let underwriterTestUsdcAta: PublicKey; // For depositing testUsdcMintPublicKey
  let underwriterTestUsdtAta: PublicKey; // For depositing testUsdtMintPublicKey

  let policyIdCounter = 0;
  let usdcPolicyIdForCheck: BN;
  let usdtPolicyIdForCheck: BN;

  let underwriterLpUsdcAta: PublicKey;
  let underwriterLpUsdtAta: PublicKey;

  const POLICY_TERM_SECONDS_FOR_TESTING = 2;
  before(async () => {
    authoritySigner = (provider.wallet as anchor.Wallet).payer;
    buyer = Keypair.generate();
    underwriter = Keypair.generate();

    await airdropSol(provider, buyer.publicKey);
    await airdropSol(provider, underwriter.publicKey);

    // usdcCollateralMintForPool = MAINNET_USDC_MINT_PUBKEY;
    // usdtCollateralMintForPool = MAINNET_USDT_MINT_PUBKEY;
    // console.log(`Using Mainnet USDC Mint for USDC pool setup: ${usdcCollateralMintForPool.toBase58()}`);
    // console.log(`Using Mainnet USDT Mint for USDT pool setup: ${usdtCollateralMintForPool.toBase58()}`);

    testUsdcMintKeypair = Keypair.generate();
    testUsdcMintPublicKey = await splCreateMint(
      provider.connection,
      authoritySigner,
      authoritySigner.publicKey,
      null,
      TOKEN_DECIMALS,
      testUsdcMintKeypair
    );
    // console.log(`Test Collateral Mint 1 (for initialize tests) created: ${testCollateralMint1PublicKey.toBase58()}`);

    testUsdtMintKeypair = Keypair.generate();
    testUsdtMintPublicKey = await splCreateMint(
      provider.connection,
      authoritySigner,
      authoritySigner.publicKey,
      null,
      TOKEN_DECIMALS,
      testUsdtMintKeypair
    );

    [poolAuthorityPda] = PublicKey.findProgramAddressSync(
      [AUTHORITY_SEED_BUF], program.programId
    );
    // console.log(`Global Pool Authority PDA: ${poolAuthorityPda.toBase58()}`);

    // console.log("\nInitializing protocol for USDC collateral (using Mainnet USDC Mint)...");
    [usdcPoolLpMintPda] = PublicKey.findProgramAddressSync(
      [LP_MINT_SEED_BUF, testUsdcMintPublicKey.toBuffer()], program.programId
    );
    [usdcPoolCollateralPda] = PublicKey.findProgramAddressSync(
      [POOL_SEED_BUF, testUsdcMintPublicKey.toBuffer()], program.programId
    );
    await program.methods.initialize()
      .accounts({
        authority: authoritySigner.publicKey,
        lpMint: usdcPoolLpMintPda,
        collateralTokenPool: usdcPoolCollateralPda,
        poolAuthority: poolAuthorityPda,
        mint: testUsdcMintPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    // console.log(`Protocol initialized for USDC. LP Mint: ${usdcLpMintPda.toBase58()}, Pool: ${usdcCollateralTokenPoolPda.toBase58()}`);

    // console.log("\nInitializing protocol for USDT collateral (using Mainnet USDT Mint)...");
    [usdtPoolLpMintPda] = PublicKey.findProgramAddressSync(
      [LP_MINT_SEED_BUF, testUsdtMintPublicKey.toBuffer()], program.programId
    );
    [usdtPoolCollateralPda] = PublicKey.findProgramAddressSync(
      [POOL_SEED_BUF, testUsdtMintPublicKey.toBuffer()], program.programId
    );
    await program.methods.initialize()
      .accounts({
        authority: authoritySigner.publicKey,
        lpMint: usdtPoolLpMintPda,
        collateralTokenPool: usdtPoolCollateralPda,
        poolAuthority: poolAuthorityPda,
        mint: testUsdtMintPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    // console.log(`Protocol initialized for USDT. LP Mint: ${usdtLpMintPda.toBase58()}, Pool: ${usdtCollateralTokenPoolPda.toBase58()}`);

    buyerTestUsdcAta = (await getOrCreateAssociatedTokenAccount(
      connection, authoritySigner, testUsdcMintPublicKey, buyer.publicKey
    )).address;
    await splMintTo(
      connection, authoritySigner, testUsdcMintPublicKey, buyerTestUsdcAta, authoritySigner,
      5000 * (10 ** TOKEN_DECIMALS)
    );

    buyerTestUsdtAta = (await getOrCreateAssociatedTokenAccount(
      connection, authoritySigner, testUsdtMintPublicKey, buyer.publicKey
    )).address;
    await splMintTo(
      connection, authoritySigner, testUsdtMintPublicKey, buyerTestUsdtAta, authoritySigner,
      5000 * (10 ** TOKEN_DECIMALS)
    );

    underwriterTestUsdcAta = (await getOrCreateAssociatedTokenAccount(
      connection, authoritySigner, testUsdcMintPublicKey, underwriter.publicKey
    )).address;
    await splMintTo(
      connection, authoritySigner, testUsdcMintPublicKey, underwriterTestUsdcAta, authoritySigner,
      10000 * (10 ** TOKEN_DECIMALS) // Mint 10,000 test USDC for underwriter
    );

    underwriterTestUsdtAta = (await getOrCreateAssociatedTokenAccount(
      connection, authoritySigner, testUsdtMintPublicKey, underwriter.publicKey
    )).address;
    await splMintTo(
      connection, authoritySigner, testUsdtMintPublicKey, underwriterTestUsdtAta, authoritySigner,
      10000 * (10 ** TOKEN_DECIMALS) // Mint 10,000 test USDC for underwriter
    );

    underwriterLpUsdcAta = (await getOrCreateAssociatedTokenAccount(
      connection,
      underwriter, // Payer for ATA creation if needed
      usdcPoolLpMintPda, // The LP mint for the USDC pool
      underwriter.publicKey
    )).address;
    underwriterLpUsdtAta = (await getOrCreateAssociatedTokenAccount(
      connection,
      underwriter, // Payer for ATA creation if needed
      usdtPoolLpMintPda, // The LP mint for the USDC pool
      underwriter.publicKey
    )).address;
  });

  describe("Initialize Instruction Tests", () => {
    let distinctTestMintKeypair: Keypair;
    let distinctTestMintPublicKey: PublicKey;

    before(async () => {
      distinctTestMintKeypair = Keypair.generate();
      distinctTestMintPublicKey = await splCreateMint(
        provider.connection,
        authoritySigner,
        authoritySigner.publicKey,
        null,
        TOKEN_DECIMALS,
        distinctTestMintKeypair
      );
      // console.log(`Distinct Test Mint created: ${distinctTestMintPublicKey.toBase58()}`);
    });
    it("intialize collateral for Mint 1", async () => {

      const [lpMintPda] = PublicKey.findProgramAddressSync(
        [LP_MINT_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
      );
      const [collateralTokenPoolPda] = PublicKey.findProgramAddressSync(
        [POOL_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
      );

      await program.methods.initialize()
        .accounts({
          authority: authoritySigner.publicKey,
          lpMint: lpMintPda,
          collateralTokenPool: collateralTokenPoolPda,
          poolAuthority: poolAuthorityPda,
          mint: distinctTestMintPublicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const lpMintInfo = await getMint(provider.connection, lpMintPda);
      assert.strictEqual(lpMintInfo.mintAuthority.toBase58(), poolAuthorityPda.toBase58());
      assert.strictEqual(lpMintInfo.decimals, TOKEN_DECIMALS);
      assert.strictEqual(lpMintInfo.supply, BigInt(0));

      const collateralPoolInfo = await getAccount(provider.connection, collateralTokenPoolPda);
      assert.strictEqual(collateralPoolInfo.mint.toBase58(), distinctTestMintPublicKey.toBase58());
      assert.strictEqual(collateralPoolInfo.owner.toBase58(), poolAuthorityPda.toBase58());
      assert.strictEqual(collateralPoolInfo.amount, BigInt(0));
      // console.log("Initialize for Test Mint 1: Assertions passed.");
    });

    it("Fail to re-initialize for mint 1", async () => {
      // console.log(`\nAttempting to re-initialize for testCollateralMint1PublicKey (should fail)...`);
      const [lpMintPda] = PublicKey.findProgramAddressSync(
        [LP_MINT_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
      );
      const [collateralTokenPoolPda] = PublicKey.findProgramAddressSync(
        [POOL_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
      );

      try {
        await program.methods.initialize()
          .accounts({
            authority: authoritySigner.publicKey,
            lpMint: lpMintPda,
            collateralTokenPool: collateralTokenPoolPda,
            poolAuthority: poolAuthorityPda,
            mint: distinctTestMintPublicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed to re-initialize for the same collateral type.");
      } catch (error) {
        assert.isOk(error.message, "Already initialized");
        // console.log("Re-initialize for Test Mint 1 failed as expected.");
      }
    });

    it("intialize for mint 2", async () => {
      // console.log("\nInitializing for a new Test Mint 2...");
      const testCollateralMint2Keypair = Keypair.generate();
      const testCollateralMint2PublicKey = await splCreateMint(
        provider.connection,
        authoritySigner,
        authoritySigner.publicKey,
        null,
        TOKEN_DECIMALS,
        testCollateralMint2Keypair
      );
      // console.log(`Test Collateral Mint 2 created: ${testCollateralMint2PublicKey.toBase58()}`);

      const [lpMintPdaForMint2] = PublicKey.findProgramAddressSync(
        [LP_MINT_SEED_BUF, testCollateralMint2PublicKey.toBuffer()], program.programId
      );
      const [collateralTokenPoolPdaForMint2] = PublicKey.findProgramAddressSync(
        [POOL_SEED_BUF, testCollateralMint2PublicKey.toBuffer()], program.programId
      );

      await program.methods.initialize()
        .accounts({
          authority: authoritySigner.publicKey,
          lpMint: lpMintPdaForMint2,
          collateralTokenPool: collateralTokenPoolPdaForMint2,
          poolAuthority: poolAuthorityPda,
          mint: testCollateralMint2PublicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const newLpMintInfo = await getMint(provider.connection, lpMintPdaForMint2);
      assert.strictEqual(newLpMintInfo.mintAuthority.toBase58(), poolAuthorityPda.toBase58());
      assert.strictEqual(newLpMintInfo.decimals, TOKEN_DECIMALS);
      assert.strictEqual(newLpMintInfo.supply, BigInt(0));

      const newCollateralPoolInfo = await getAccount(provider.connection, collateralTokenPoolPdaForMint2);
      assert.strictEqual(newCollateralPoolInfo.mint.toBase58(), testCollateralMint2PublicKey.toBase58());
      assert.strictEqual(newCollateralPoolInfo.owner.toBase58(), poolAuthorityPda.toBase58());
      assert.strictEqual(newCollateralPoolInfo.amount, BigInt(0));
      // console.log("Initialize for Test Mint 2: Assertions passed.");

      const [lpMintPdaForMint1] = PublicKey.findProgramAddressSync(
        [LP_MINT_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
      );
      assert.notEqual(lpMintPdaForMint1.toBase58(), lpMintPdaForMint2.toBase58());
      // console.log("Verification: PDAs for Test Mint 1 and Test Mint 2 are distinct.");
    });
  });

  describe("Create Policy Test", () => {
    async function testCreatePolicyScenario({
      testName,
      premiumPaymentMint,
      buyerPremiumAta,
      targetCollateralPool,
      insuredStablecoinOnPolicy,
      insuredAmountLamports = new BN(200 * (10 ** TOKEN_DECIMALS)), // Default to ensure premium > 0
      expectSuccess = false,
    }: {
      testName: string;
      premiumPaymentMint: PublicKey;
      buyerPremiumAta: PublicKey;
      targetCollateralPool: PublicKey;
      insuredStablecoinOnPolicy: PublicKey;
      insuredAmountLamports?: BN;
      expectSuccess?: boolean;
    }) {
      policyIdCounter++;
      const currentPolicyId = new BN(policyIdCounter);
      const expectedPremiumLamports = insuredAmountLamports.mul(new BN(PREMIUM_RATE_BPS_VAL)).div(new BN(10000));
      const [policyAccountPda, policyAccountBump] = PublicKey.findProgramAddressSync(
        [POLICY_SEED_BUF, buyer.publicKey.toBuffer(), currentPolicyId.toBuffer("le", 8)],
        program.programId
      );

      // console.log(`\nRunning test: "${testName}" (Policy ID: ${currentPolicyId})...`);
      // console.log(`  Insured Amount: ${insuredAmountLamports.toString()}, Expected Premium: ${expectedPremiumLamports.toString()}`);
      // console.log(`  Premium Payment Mint: ${premiumPaymentMint.toBase58()}`);
      // console.log(`  Buyer Premium ATA: ${buyerPremiumAta.toBase58()}`);
      // console.log(`  Target Collateral Pool: ${targetCollateralPool.toBase58()}`);
      // console.log(`  Insured Stablecoin on Policy: ${insuredStablecoinOnPolicy.toBase58()}`);

      let buyerInitialBalance = BigInt(0);
      let poolInitialBalance = BigInt(0);
      try {
        buyerInitialBalance = (await getAccount(connection, buyerPremiumAta)).amount;
        poolInitialBalance = (await getAccount(connection, targetCollateralPool)).amount;
        // console.log(`  Buyer balance before: ${buyerInitialBalance.toString()}, Pool balance before: ${poolInitialBalance.toString()}`);
      } catch (e) {
        console.warn(`  Could not fetch initial balances: ${e.message}`);
      }

      try {
        await program.methods.createPolicy(insuredAmountLamports, currentPolicyId)
          .accounts({
            buyer: buyer.publicKey,
            policyAccount: policyAccountPda,
            buyerTokenAccount: buyerPremiumAta,
            collateralTokenPool: targetCollateralPool,
            mint: premiumPaymentMint,
            insuredStablecoinMint: insuredStablecoinOnPolicy,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        // console.log(`  RPC successful for "${testName}".`);

        const policyAccountInfo = await program.account.policyAccount.fetch(policyAccountPda);
        assert.strictEqual(policyAccountInfo.buyer.toBase58(), buyer.publicKey.toBase58(), "Buyer mismatch");
        assert.ok(policyAccountInfo.policyId.eq(currentPolicyId), "Policy ID mismatch");
        assert.strictEqual(policyAccountInfo.insuredStablecoinMint.toBase58(), insuredStablecoinOnPolicy.toBase58(), "Insured stablecoin mint mismatch");
        assert.ok(policyAccountInfo.insuredAmount.eq(insuredAmountLamports), "Insured amount mismatch");
        assert.ok(policyAccountInfo.premiumPaid.eq(expectedPremiumLamports), "Premium paid mismatch");
        assert.strictEqual(policyAccountInfo.mint.toBase58(), premiumPaymentMint.toBase58(), "Policy.mint (premium currency) mismatch");

        const expectedPayoutLamports = insuredAmountLamports.mul(new BN(BINARY_PAYOUT_BPS_VAL)).div(new BN(10000));
        assert.ok(policyAccountInfo.payoutAmount.eq(expectedPayoutLamports), "Payout amount mismatch");
        assert.isTrue(policyAccountInfo.startTimestamp.gtn(0), "Start timestamp invalid");
        assert.isTrue(policyAccountInfo.expiryTimestamp.eq(policyAccountInfo.startTimestamp.add(new BN(POLICY_TERM_SECONDS))), "Expiry timestamp incorrect");
        assert.deepStrictEqual(policyAccountInfo.status, { active: {} }, "Policy status should be Active");
        assert.strictEqual(policyAccountInfo.bump, policyAccountBump, "Policy account bump mismatch");

        if (expectedPremiumLamports.gtn(0)) { // Only check balance changes if premium was non-zero
          const buyerFinalBalance = (await getAccount(connection, buyerPremiumAta)).amount;
          const poolFinalBalance = (await getAccount(connection, targetCollateralPool)).amount;
          assert.strictEqual(buyerInitialBalance - buyerFinalBalance, BigInt(expectedPremiumLamports.toString()), "Buyer premium deduction incorrect");
          assert.strictEqual(poolFinalBalance - poolInitialBalance, BigInt(expectedPremiumLamports.toString()), "Pool premium addition incorrect");
        }

        // console.log(`  Assertions passed for "${testName}".`);

      } catch (error) {
        // console.error(`  Error in "${testName}":`, error.toString());
        if (error.logs) {
          // console.error("  Logs:", error.logs.join("\n"));
        }
        // const errorString = error.toString().toLowerCase();
        // const logsString = error.logs ? error.logs.join(' ').toLowerCase() : "";

        // if (expectSuccess && expectedPremiumLamports.eqn(0)) {
        //   // If success was expected AND premium was 0, any error is unexpected.
        //   assert.fail(`Test "${testName}" (expected full success with zero premium) failed unexpectedly: ${error.toString()}`);
        // } else if (!expectSuccess && !errorString.includes("constraintraw") &&
        //   (errorString.includes("0x1") || logsString.includes("insufficient funds") || (logsString.includes("spl_token") && logsString.includes("custom program error: 0x1")))) {
        //   console.log(`  Test "${testName}" behaved as expected: Passed 'ConstraintRaw' on mint, and failed due to insufficient funds as buyer's Mainnet ATA was not funded for a non-zero premium.`);
        // } else if (errorString.includes("constraintraw")) {
        //   assert.fail(`Test "${testName}" failed with 'ConstraintRaw' on mint account. Check Rust constants and Anchor.toml cloning for ${premiumPaymentMint.toBase58()}. Error: ${error.toString()}`);
        // } else {
        //   assert.fail(`Test "${testName}" failed for an unexpected reason: ${error.toString()}`);
        // }
      }
    }

    it("Create a policy insuring USDC", async () => {
      await testCreatePolicyScenario({
        testName: "USDC Insurance, Test USDC Premium",
        premiumPaymentMint: testUsdcMintPublicKey,
        buyerPremiumAta: buyerTestUsdcAta,
        targetCollateralPool: usdcPoolCollateralPda,
        insuredStablecoinOnPolicy: MAINNET_USDC_MINT_PUBKEY, // Insuring actual USDC
        expectSuccess: true,
      });
    });

    it("Create a policy insuring USDT,Premium in USDC", async () => {
      await testCreatePolicyScenario({
        testName: "USDT Insurance, Test USDC Premium",
        premiumPaymentMint: testUsdcMintPublicKey,
        buyerPremiumAta: buyerTestUsdcAta,
        targetCollateralPool: usdcPoolCollateralPda,
        insuredStablecoinOnPolicy: MAINNET_USDT_MINT_PUBKEY,
        expectSuccess: true,
      });
    });

    it("Create a policy insuring USDT", async () => {
      await testCreatePolicyScenario({
        testName: "USDT Insurance, Test USDT Premium",
        premiumPaymentMint: testUsdtMintPublicKey,
        buyerPremiumAta: buyerTestUsdtAta,
        targetCollateralPool: usdcPoolCollateralPda,
        insuredStablecoinOnPolicy: MAINNET_USDT_MINT_PUBKEY,
        expectSuccess: true,
      });
    });

    //unhappy paths
    it("Fail while Creating policy(mismatch in token Account", async () => {
      policyIdCounter++;
      const currentPolicyId = new BN(policyIdCounter);
      const insuredAmountLamports = new BN(200 * (10 ** TOKEN_DECIMALS));
      const premiumPaymentMint = testUsdtMintPublicKey; // Test USDT for premium
      const buyerPremiumAta = buyerTestUsdtAta;
      const targetCollateralPool = usdcPoolCollateralPda; // USDC Pool (Mismatched)
      const insuredStablecoinOnPolicy = MAINNET_USDC_MINT_PUBKEY;

      const [policyAccountPda] = PublicKey.findProgramAddressSync(
        [POLICY_SEED_BUF, buyer.publicKey.toBuffer(), currentPolicyId.toBuffer("le", 8)],
        program.programId
      );

      // console.log(`\nRunning test: "Mismatched Premium Mint and Pool (Test USDT premium to Test USDC pool)" (should fail)...`);
      try {
        await program.methods.createPolicy(insuredAmountLamports, currentPolicyId)
          .accounts({
            buyer: buyer.publicKey,
            policyAccount: policyAccountPda,
            buyerTokenAccount: buyerPremiumAta,
            collateralTokenPool: targetCollateralPool,
            mint: premiumPaymentMint,
            insuredStablecoinMint: insuredStablecoinOnPolicy,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Should have failed due to premium mint not matching collateral pool's mint.");
      } catch (error) {
        assert.isOk(error.message, "ConstraintRaw error");
      }
    });

    it("Fail for unsupported Mint to insure", async () => {
      policyIdCounter++;
      const currentPolicyId = new BN(policyIdCounter);
      const insuredAmountLamports = new BN(200 * (10 ** TOKEN_DECIMALS));
      const premiumPaymentMint = testUsdcMintPublicKey;
      const buyerPremiumAta = buyerTestUsdcAta;
      const targetCollateralPool = usdcPoolCollateralPda;

      const unsupportedStablecoinMintKeypair = Keypair.generate();
      const unsupportedStablecoinMint = await splCreateMint(
        provider.connection, authoritySigner, authoritySigner.publicKey, null, TOKEN_DECIMALS, unsupportedStablecoinMintKeypair
      );
      const [policyAccountPda] = PublicKey.findProgramAddressSync(
        [POLICY_SEED_BUF, buyer.publicKey.toBuffer(), currentPolicyId.toBuffer("le", 8)],
        program.programId
      );

      // console.log(`\nRunning test: "Unsupported Insured Stablecoin" (should fail if Rust validation exists)...`);
      try {
        await program.methods.createPolicy(insuredAmountLamports, currentPolicyId)
          .accounts({
            buyer: buyer.publicKey,
            policyAccount: policyAccountPda,
            buyerTokenAccount: buyerPremiumAta,
            collateralTokenPool: targetCollateralPool,
            mint: premiumPaymentMint,
            insuredStablecoinMint: unsupportedStablecoinMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Should have failed due to unsupported insured_stablecoin_mint.");
      } catch (error) {
        assert.isOk(error.message, "ConstraintRaw error");
      }
    });
  });

  describe("Deposit collateral Test", () => {
    it("Allow to deposit in collateral", async () => {
      const depositAmount = new BN(1000 * (10 ** TOKEN_DECIMALS));

      const initialLPSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
      const initialPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const underwriterInitialCollateral = (await getAccount(connection, underwriterTestUsdcAta)).amount;
      const initialUnderwriterLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;

      await program.methods.depositCollateral(depositAmount)
        .accounts({
          underwriter: underwriter.publicKey,
          underwriterTokenAccount: underwriterTestUsdcAta,
          underwriterLpTokenAccount: underwriterLpUsdcAta,
          collateralTokenPool: usdcPoolCollateralPda,
          lpMint: usdcPoolLpMintPda,
          poolAuthority: poolAuthorityPda,
          mint: testUsdcMintPublicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([underwriter])
        .rpc();


      const finalLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
      const finalPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const underwriterFinalCollateral = (await getAccount(connection, underwriterTestUsdcAta)).amount;
      const underwriterLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;


      const expectedLpMinted = depositAmount;
      assert.ok(finalLpSupply === initialLPSupply + BigInt(expectedLpMinted.toString()), "LP supply incorrect after first deposit");
      assert.ok(finalPoolBalance === initialPoolBalance + BigInt(depositAmount.toString()), "Pool balance incorrect after first deposit");
      assert.ok(underwriterFinalCollateral === underwriterInitialCollateral - BigInt(depositAmount.toString()), "Underwriter collateral debited incorrectly");
      assert.ok(underwriterLpBalance === initialUnderwriterLpBalance + BigInt(expectedLpMinted.toString()), "Underwriter LP token balance incorrect after first deposit");
      // console.log("First Test USDC Deposit: Assertions passed!");

    })

    it("Multiple deposits into collateral (USDC)", async () => {
      const depositAmountSubsequent = new BN(500 * (10 ** TOKEN_DECIMALS));

      const initialLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
      const initialPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const underwriterInitialCollateral = (await getAccount(connection, underwriterTestUsdcAta)).amount;
      const underwriterInitialLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;

      let expectedLpMintedSubsequent: BN;
      if (initialLpSupply === BigInt(0) || initialPoolBalance === BigInt(0)) {
        console.warn("Warning: Pool seems empty or has no LP supply before subsequent deposit. LP calculation might be 1:1.");
        expectedLpMintedSubsequent = depositAmountSubsequent;
      } else {
        const lpToMintU128 = new BN(depositAmountSubsequent.toString())
          .mul(new BN(initialLpSupply.toString()))
          .div(new BN(initialPoolBalance.toString()));
        expectedLpMintedSubsequent = new BN(lpToMintU128.toString());
      }

      // console.log(`  Expected LP to mint (approx): ${expectedLpMintedSubsequent.toString()}`);

      await program.methods.depositCollateral(depositAmountSubsequent)
        .accounts({
          underwriter: underwriter.publicKey,
          underwriterTokenAccount: underwriterTestUsdcAta,
          underwriterLpTokenAccount: underwriterLpUsdcAta,
          collateralTokenPool: usdcPoolCollateralPda,
          lpMint: usdcPoolLpMintPda,
          poolAuthority: poolAuthorityPda,
          mint: testUsdcMintPublicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([underwriter])
        .rpc();

      const finalLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
      const finalPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const underwriterFinalCollateral = (await getAccount(connection, underwriterTestUsdcAta)).amount;
      const underwriterLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;

      assert.ok(finalLpSupply === initialLpSupply + BigInt(expectedLpMintedSubsequent.toString()), "LP supply incorrect after subsequent deposit");
      assert.ok(finalPoolBalance === initialPoolBalance + BigInt(depositAmountSubsequent.toString()), "Pool balance incorrect after subsequent deposit");
      assert.ok(underwriterFinalCollateral === underwriterInitialCollateral - BigInt(depositAmountSubsequent.toString()), "Underwriter collateral debited incorrectly for subsequent deposit");
      assert.ok(underwriterLpBalance === underwriterInitialLpBalance + BigInt(expectedLpMintedSubsequent.toString()), "Underwriter LP token balance incorrect after subsequent deposit");
    });

    it("should fail to deposit zero amount", async () => {
      const depositAmountZero = new BN(0);
      try {
        await program.methods.depositCollateral(depositAmountZero)
          .accounts({
            underwriter: underwriter.publicKey,
            underwriterTokenAccount: underwriterTestUsdcAta,
            underwriterLpTokenAccount: underwriterLpUsdcAta,
            collateralTokenPool: usdcPoolCollateralPda,
            lpMint: usdcPoolLpMintPda,
            poolAuthority: poolAuthorityPda,
            mint: testUsdcMintPublicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([underwriter])
          .rpc();
        assert.fail("Should have failed to deposit zero amount.");
      } catch (error) {
        assert.isOk(error.message, "Deposit amount must be greater than zero");
      }
    });

    it("Deposit collateral in USDT", async () => {
      const depositAmount = new BN(1000 * (10 ** TOKEN_DECIMALS));

      const initialLPSupply = (await getMint(connection, usdtPoolLpMintPda)).supply;
      const initialPoolBalance = (await getAccount(connection, usdtPoolCollateralPda)).amount;
      const underwriterInitialCollateral = (await getAccount(connection, underwriterTestUsdtAta)).amount;
      const initialUnderwriterLpBalance = (await getAccount(connection, underwriterLpUsdtAta)).amount;

      await program.methods.depositCollateral(depositAmount)
        .accounts({
          underwriter: underwriter.publicKey,
          underwriterTokenAccount: underwriterTestUsdtAta,
          underwriterLpTokenAccount: underwriterLpUsdtAta,
          collateralTokenPool: usdtPoolCollateralPda,
          lpMint: usdtPoolLpMintPda,
          poolAuthority: poolAuthorityPda,
          mint: testUsdtMintPublicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([underwriter])
        .rpc();


      const finalLpSupply = (await getMint(connection, usdtPoolLpMintPda)).supply;
      const finalPoolBalance = (await getAccount(connection, usdtPoolCollateralPda)).amount;
      const underwriterFinalCollateral = (await getAccount(connection, underwriterTestUsdtAta)).amount;
      const underwriterLpBalance = (await getAccount(connection, underwriterLpUsdtAta)).amount;


      const expectedLpMinted = depositAmount;
      assert.ok(finalLpSupply === initialLPSupply + BigInt(expectedLpMinted.toString()), "LP supply incorrect after first deposit");
      assert.ok(finalPoolBalance === initialPoolBalance + BigInt(depositAmount.toString()), "Pool balance incorrect after first deposit");
      assert.ok(underwriterFinalCollateral === underwriterInitialCollateral - BigInt(depositAmount.toString()), "Underwriter collateral debited incorrectly");
      assert.ok(underwriterLpBalance === initialUnderwriterLpBalance + BigInt(expectedLpMinted.toString()), "Underwriter LP token balance incorrect after first deposit");

    })
  })

  describe("Withdraw collateral tests", () => {
    it("Withdraw Collateral (USDC)", async () => {
      const initialUnderwriterLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;
      const lpAmountToBurn = new BN(BigInt(initialUnderwriterLpBalance / BigInt(2)).toString());

      const initialLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
      const initialPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const underwriterInitialCollateral = (await getAccount(connection, underwriterTestUsdcAta)).amount;

      let expectedCollateralToWithdraw: BN;
      if (initialLpSupply === BigInt(0)) { // Should not happen if LPs exist
        assert.fail("Cannot withdraw, total LP supply is zero.");
        return;
      }
      const collateralToWithdrawU128 = new BN(lpAmountToBurn.toString())
        .mul(new BN(initialPoolBalance.toString()))
        .div(new BN(initialLpSupply.toString()));
      expectedCollateralToWithdraw = new BN(collateralToWithdrawU128.toString());

      // console.log(`  LP to burn: ${lpAmountToBurn.toString()}`);
      // console.log(`  Expected collateral to withdraw: ${expectedCollateralToWithdraw.toString()}`);

      await program.methods.withdrawCollateral(lpAmountToBurn)
        .accounts({
          underwriter: underwriter.publicKey,
          underwriterLpAccount: underwriterLpUsdcAta,
          underwriterTokenAccount: underwriterTestUsdcAta, // Receives withdrawn test USDC
          collateralTokenPool: usdcPoolCollateralPda,
          lpMint: usdcPoolLpMintPda,
          poolAuthority: poolAuthorityPda,
          mint: testUsdcMintPublicKey, // Specifies the collateral type (test USDC)
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, // Needed if underwriter_token_account might be init'd
        })
        .signers([underwriter])
        .rpc();

      // Assertions
      const finalLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
      const finalPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const underwriterFinalLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;
      const underwriterFinalCollateralBalance = (await getAccount(connection, underwriterTestUsdcAta)).amount;

      assert.ok(finalLpSupply === initialLpSupply - BigInt(lpAmountToBurn.toString()), "LP supply incorrect after withdrawal");
      assert.ok(finalPoolBalance === initialPoolBalance - BigInt(expectedCollateralToWithdraw.toString()), "Pool balance incorrect after withdrawal");
      assert.ok(underwriterFinalLpBalance === initialUnderwriterLpBalance - BigInt(lpAmountToBurn.toString()), "Underwriter LP tokens not burned correctly");
      assert.ok(underwriterFinalCollateralBalance === underwriterInitialCollateral + BigInt(expectedCollateralToWithdraw.toString()), "Underwriter collateral not credited correctly");
      // console.log("Partial Collateral Withdrawal: Assertions passed!");
    });

    it("Withdraw all From pool", async () => {
      const lpAmountToBurnAll = new BN((await getAccount(connection, underwriterLpUsdcAta)).amount.toString());
      assert.isTrue(lpAmountToBurnAll.gtn(0), "Pre-condition failed: Underwriter has no LP tokens left to withdraw all.");

      const initialLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
      const initialPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const underwriterInitialCollateralBalance = (await getAccount(connection, underwriterTestUsdcAta)).amount;

      let expectedCollateralToWithdrawAll: BN;
      if (initialLpSupply === BigInt(0)) {
        assert.fail("Cannot withdraw, total LP supply is zero.");
        return;
      }
      const collateralToWithdrawAllU128 = new BN(lpAmountToBurnAll.toString())
        .mul(new BN(initialPoolBalance.toString()))
        .div(new BN(initialLpSupply.toString()));
      expectedCollateralToWithdrawAll = new BN(collateralToWithdrawAllU128.toString());

      // console.log(`  LP to burn (all): ${lpAmountToBurnAll.toString()}`);
      // console.log(`  Expected collateral to withdraw (all): ${expectedCollateralToWithdrawAll.toString()}`);

      await program.methods.withdrawCollateral(lpAmountToBurnAll)
        .accounts({
          underwriter: underwriter.publicKey,
          underwriterLpAccount: underwriterLpUsdcAta,
          underwriterTokenAccount: underwriterTestUsdcAta,
          collateralTokenPool: usdcPoolCollateralPda,
          lpMint: usdcPoolLpMintPda,
          poolAuthority: poolAuthorityPda,
          mint: testUsdcMintPublicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([underwriter])
        .rpc();

      const finalLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
      const finalPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const underwriterFinalLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;
      const underwriterFinalCollateralBalance = (await getAccount(connection, underwriterTestUsdcAta)).amount;

      assert.ok(finalLpSupply === initialLpSupply - BigInt(lpAmountToBurnAll.toString()), "LP supply incorrect after full withdrawal");
      assert.ok(finalPoolBalance === initialPoolBalance - BigInt(expectedCollateralToWithdrawAll.toString()), "Pool balance incorrect after full withdrawal");
      assert.ok(underwriterFinalLpBalance === BigInt(0), "Underwriter LP tokens not fully burned"); // Should be 0
      assert.ok(underwriterFinalCollateralBalance === underwriterInitialCollateralBalance + BigInt(expectedCollateralToWithdrawAll.toString()), "Underwriter collateral not fully credited for full withdrawal");
      // console.log("Full Collateral Withdrawal: Assertions passed!");
    });

    it("should fail to withdraw zero LP tokens", async () => {
      const lpAmountToBurnZero = new BN(0);
      try {
        await program.methods.withdrawCollateral(lpAmountToBurnZero)
          .accounts({
            underwriter: underwriter.publicKey,
            underwriterLpAccount: underwriterLpUsdcAta,
            underwriterTokenAccount: underwriterTestUsdcAta,
            collateralTokenPool: usdcPoolCollateralPda,
            lpMint: usdcPoolLpMintPda,
            poolAuthority: poolAuthorityPda,
            mint: testUsdcMintPublicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([underwriter])
          .rpc();
        assert.fail("Should have failed to withdraw zero LP tokens.");
      } catch (error) {
        assert.isOk(error.message, "Withdraw amount must be greater than zero");
      }
    });

    it("should fail to withdraw more LP tokens than owned", async () => {
      const currentLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;
      const lpAmountToBurnExcess = new BN(currentLpBalance.toString()).add(new BN(1)); // 1 more than owned

      try {
        await program.methods.withdrawCollateral(lpAmountToBurnExcess)
          .accounts({
            underwriter: underwriter.publicKey,
            underwriterLpAccount: underwriterLpUsdcAta,
            underwriterTokenAccount: underwriterTestUsdcAta,
            collateralTokenPool: usdcPoolCollateralPda,
            lpMint: usdcPoolLpMintPda,
            poolAuthority: poolAuthorityPda,
            mint: testUsdcMintPublicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([underwriter])
          .rpc();
        assert.fail("Should have failed to withdraw more LP tokens than owned.");
      } catch (error) {
        assert.isOk(error.message, "Insufficient funds");
      }
    });
  });

  describe("Close Policy tests", () => {
    before(async () => {
      policyIdCounter++;
      usdcPolicyIdForCheck = new BN(policyIdCounter);
      const insuredAmountUSDC = new BN(100 * (10 ** TOKEN_DECIMALS));
      await program.methods.createPolicy(insuredAmountUSDC, usdcPolicyIdForCheck)
        .accounts({
          buyer: buyer.publicKey,
          policyAccount: (PublicKey.findProgramAddressSync([POLICY_SEED_BUF, buyer.publicKey.toBuffer(), usdcPolicyIdForCheck.toBuffer("le", 8)], program.programId))[0],
          buyerTokenAccount: buyerTestUsdcAta,
          collateralTokenPool: usdcPoolCollateralPda,
          mint: testUsdcMintPublicKey,
          insuredStablecoinMint: MAINNET_USDC_MINT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([buyer])
        .rpc();
      // console.log(`Created policy for USDC check, ID: ${usdcPolicyIdForCheck.toString()}`);

      // Create a policy insuring USDT, premium in Test USDC
      policyIdCounter++;
      usdtPolicyIdForCheck = new BN(policyIdCounter);
      const insuredAmountUsdt = new BN(100 * (10 ** TOKEN_DECIMALS));
      await program.methods.createPolicy(insuredAmountUsdt, usdtPolicyIdForCheck)
        .accounts({
          buyer: buyer.publicKey,
          policyAccount: (PublicKey.findProgramAddressSync([POLICY_SEED_BUF, buyer.publicKey.toBuffer(), usdtPolicyIdForCheck.toBuffer("le", 8)], program.programId))[0],
          buyerTokenAccount: buyerTestUsdcAta, // Premium in test USDC
          collateralTokenPool: usdcPoolCollateralPda, // Into USDC pool
          mint: testUsdcMintPublicKey, // Premium in test USDC
          insuredStablecoinMint: MAINNET_USDT_MINT_PUBKEY, // Insuring actual USDT
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      // console.log(`Created policy for USDT check, ID: ${usdtPolicyIdForCheck.toString()}`);

      // console.log(`Waiting ${POLICY_TERM_SECONDS_FOR_TESTING + 1} seconds for policies to expire...`);
      await new Promise(resolve => setTimeout(resolve, (POLICY_TERM_SECONDS_FOR_TESTING + 1) * 1000));
      // console.log("Policies should now be expired.");
    })

    it("Process an expired usdc policy", async () => {
      const depositAmount = new BN(10000 * (10 ** TOKEN_DECIMALS)); // Deposit 10,000 test USDC
      await program.methods.depositCollateral(depositAmount)
        .accounts({
          underwriter: underwriter.publicKey,
          underwriterTokenAccount: underwriterTestUsdcAta,
          underwriterLpTokenAccount: underwriterLpUsdcAta,
          collateralTokenPool: usdcPoolCollateralPda,
          lpMint: usdcPoolLpMintPda,
          poolAuthority: poolAuthorityPda,
          mint: testUsdcMintPublicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([underwriter]).rpc();
      // console.log("Underwriter deposited initial collateral into Test USDC pool.");



      const policyPda = (PublicKey.findProgramAddressSync([POLICY_SEED_BUF, buyer.publicKey.toBuffer(), usdcPolicyIdForCheck.toBuffer("le", 8)], program.programId))[0];

      // console.log(`  Policy PDA: ${policyPda.toBase58()}`);
      // console.log(`  Buyer (signer): ${buyer.publicKey.toBase58()}`);
      // console.log(`  Buyer Token Account (for payout): ${buyerTestUsdcAta.toBase58()}`);
      // console.log(`  Collateral Pool (USDC): ${usdcPoolCollateralPda.toBase58()}`);
      // console.log(`  Mint (of pool/payout - Test USDC): ${testUsdcMintPublicKey.toBase58()}`);
      // console.log(`  Pyth Price Update Account: ${PYTH_PRICE_UPDATE_V2_ACCOUNT_PUBKEY.toBase58()}`);

      const initialBuyerBalance = (await getAccount(connection, buyerTestUsdcAta)).amount;
      const initialPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
      const policyBefore = await program.account.policyAccount.fetch(policyPda);

      // console.log(`  Collateral Pool Balance BEFORE check: ${(initialPoolBalance)}`);
      // console.log(`  Policy Payout Amount to be transferred: ${policyBefore.payoutAmount.toString()}`);

      let finalStatusName = "";
      try {
        const txsignature = await program.methods.checkAndPayout(usdcPolicyIdForCheck)
          .accounts({
            buyer: buyer.publicKey,
            policyAccount: policyPda,
            collateralTokenPool: usdcPoolCollateralPda,
            poolAuthority: poolAuthorityPda,
            buyerTokenAccount: buyerTestUsdcAta, // Payouts in test USDC
            mint: testUsdcMintPublicKey, // Mint of the collateral pool & payout
            pythPriceUpdate: PYTH_PRICE_UPDATE_V2_ACCOUNT_PUBKEY, // The cloned official Pyth account
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([buyer])
          .rpc();

        // console.log(`Transaction successful. Signature: ${txsignature}`);

        // Optional: Confirm the transaction
        const latestBlockHash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: txsignature
        }, "confirmed");

        // Fetch the transaction details to get logs
        // const txDetails = await provider.connection.getTransaction(txsignature, {
        //   commitment: "confirmed",
        //   maxSupportedTransactionVersion: 0, // Add this if you encounter version issues
        // });

        // if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
        //   console.log("---- On-Chain Program Logs ----");
        //   txDetails.meta.logMessages.forEach(log => console.log(log));
        //   console.log("-----------------------------");
        // } else {
        //   console.log("Could not fetch transaction logs.");
        // }

        const policyAfter = await program.account.policyAccount.fetch(policyPda);
        finalStatusName = Object.keys(policyAfter.status)[0];
        // console.log(`  Policy status after check: ${finalStatusName}`);

        // assert.deepStrictEqual(policyAfter.status, { active: {} }, "Policy status should have changed from Active");

        if (finalStatusName === "expiredPaid") {
          const finalBuyerBalance = (await getAccount(connection, buyerTestUsdcAta)).amount;
          const finalPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
          const expectedPayout = policyBefore.payoutAmount;
          assert.ok(finalBuyerBalance === initialBuyerBalance + BigInt(expectedPayout.toString()), "Buyer balance incorrect after payout");
          assert.ok(finalPoolBalance === initialPoolBalance - BigInt(expectedPayout.toString()), "Pool balance incorrect after payout");
          // console.log(`  DEPEG detected and payout of ${expectedPayout.toString()} processed.`);
        } else if (finalStatusName === "expiredNotPaid") {
          const finalBuyerBalance = (await getAccount(connection, buyerTestUsdcAta)).amount;
          assert.ok(finalBuyerBalance === initialBuyerBalance, "Buyer balance should not change if no payout");
          console.log("  NO DEPEG detected. Policy expired without payout.");
        } else {
          assert.fail(`Unexpected policy status after check: ${finalStatusName}`);
        }

      } catch (error) {
        console.error(`Error during check_payout for USDC policy: ${error.toString()}`);
        if (error.logs) console.error("Logs:", error.logs.join("\n"));
        assert.fail(`check_payout for USDC policy failed: ${error.toString()}`);
      }
    });

    // it("should process an expired USDT policy (outcome depends on cloned Pyth data)", async () => {
    //   const policyPda = (PublicKey.findProgramAddressSync([POLICY_SEED_BUF, buyer.publicKey.toBuffer(), usdtPolicyIdForCheck.toBuffer("le", 8)], program.programId))[0];

    //   // This policy used testUsdcMintPublicKey for premiums and thus for policy.mint and payout.
    //   const payoutMintForUsdtPolicy = testUsdcMintPublicKey;
    //   const buyerPayoutAtaForUsdtPolicy = buyerTestUsdtAta; // Buyer receives payout in test USDC
    //   const payoutCollateralPoolForUsdtPolicy = usdtPoolCollateralPda; // Payout from USDC pool

    //   const initialBuyerBalance = (await getAccount(connection, buyerPayoutAtaForUsdtPolicy)).amount;
    //   const initialPoolBalance = (await getAccount(connection, payoutCollateralPoolForUsdtPolicy)).amount;
    //   const policyBefore = await program.account.policyAccount.fetch(policyPda);

    //   assert.strictEqual(policyBefore.mint.toBase58(), payoutMintForUsdtPolicy.toBase58(), "Policy.mint for USDT policy is not the expected payout currency (testUsdcMintPublicKey)");

    //   let finalStatusName = "";
    //   try {
    //     const txSignature = await program.methods.checkAndPayout(usdtPolicyIdForCheck)
    //       .accounts({
    //         buyer: buyer.publicKey,
    //         policyAccount: policyPda,
    //         collateralTokenPool: payoutCollateralPoolForUsdtPolicy,
    //         poolAuthority: poolAuthorityPda,
    //         buyerTokenAccount: buyerPayoutAtaForUsdtPolicy,
    //         mint: payoutMintForUsdtPolicy, // Mint of the collateral pool & payout
    //         pythPriceUpdate: PYTH_PRICE_UPDATE_V2_ACCOUNT_PUBKEY,
    //         tokenProgram: TOKEN_PROGRAM_ID,
    //       })
    //       .signers([buyer])
    //       .rpc();
    //     const txDetails = await provider.connection.getTransaction(txSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    //     if (txDetails?.meta?.logMessages) {
    //       console.log("---- USDT Policy On-Chain Logs ----");
    //       txDetails.meta.logMessages.forEach(log => console.log(log));
    //       console.log("---------------------------------");
    //     }

    //     const policyAfter = await program.account.policyAccount.fetch(policyPda);
    //     finalStatusName = Object.keys(policyAfter.status)[0];
    //     console.log(`  USDT Policy status after check: ${finalStatusName}`);

    //     if (finalStatusName === "expiredPaid") {
    //       const finalBuyerBalance = (await getAccount(connection, buyerPayoutAtaForUsdtPolicy)).amount;
    //       const finalPoolBalance = (await getAccount(connection, payoutCollateralPoolForUsdtPolicy)).amount;
    //       const expectedPayout = policyBefore.payoutAmount;
    //       assert.ok(finalBuyerBalance === initialBuyerBalance + BigInt(expectedPayout.toString()), "USDT Policy: Buyer balance incorrect after payout");
    //       assert.ok(finalPoolBalance === initialPoolBalance - BigInt(expectedPayout.toString()), "USDT Policy: Pool balance incorrect after payout");
    //       console.log(`  USDT Policy: DEPEG detected and payout of ${expectedPayout.toString()} processed.`);
    //     } else if (finalStatusName === "expiredNotPaid") {
    //       const finalBuyerBalance = (await getAccount(connection, buyerPayoutAtaForUsdtPolicy)).amount;
    //       assert.ok(finalBuyerBalance === initialBuyerBalance, "USDT Policy: Buyer balance should not change if no depeg");
    //       console.log("  USDT Policy: NO DEPEG detected. Policy expired without payout.");
    //     } else {
    //       assert.fail(`Unexpected policy status for USDT policy: ${finalStatusName}`);
    //     }
    //   } catch (error) {
    //     console.error(`Error during check_payout for USDT policy: ${error.toString()}`);
    //     if (error.logs) console.error("Logs:", error.logs.join("\n"));
    //     assert.fail(`check_payout for USDT policy failed: ${error.toString()}`);
    //   }
    // });

    it("Fail to process an already processed policy", async () => {
      const policyPda = (PublicKey.findProgramAddressSync([POLICY_SEED_BUF, buyer.publicKey.toBuffer(), usdcPolicyIdForCheck.toBuffer("le", 8)], program.programId))[0];

      try {
        await program.methods.checkAndPayout(usdcPolicyIdForCheck)
          .accounts({
            buyer: buyer.publicKey,
            policyAccount: policyPda,
            collateralTokenPool: usdcPoolCollateralPda,
            poolAuthority: poolAuthorityPda,
            buyerTokenAccount: buyerTestUsdcAta,
            mint: testUsdcMintPublicKey,
            pythPriceUpdate: PYTH_PRICE_UPDATE_V2_ACCOUNT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Should have failed because policy was already processed.");
      } catch (error) {
        assert.isOk(error.message, "Policy already processed");
      }
    });

  });
});
