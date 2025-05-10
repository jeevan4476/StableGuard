import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { StableGuard } from "../target/types/stable_guard"; // Adjust if your type path is different
import {
    TOKEN_PROGRAM_ID,
    getMint,
    getAccount,
    createMint as splCreateMint,
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

// --- Helper Function ---
async function airdropSol(
    provider: anchor.AnchorProvider,
    targetPublicKey: PublicKey,
    lamports: number = 10 * LAMPORTS_PER_SOL
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
        console.warn(`Airdrop to ${targetPublicKey.toBase58()} failed: ${error.message}`);
        return "";
    }
}

// --- Constants ---
const LP_MINT_SEED_BUF = Buffer.from("lp_mint");
const POOL_SEED_BUF = Buffer.from("collateral_pool");
const AUTHORITY_SEED_BUF = Buffer.from("pool_authority");
const POLICY_SEED_BUF = Buffer.from("policy");

const TOKEN_DECIMALS = 6;
const PREMIUM_RATE_BPS_VAL = 50;
const BINARY_PAYOUT_BPS_VAL = 1000;
const POLICY_TERM_SECONDS = 7 * 24 * 60 * 60;

// Mainnet mints for `insured_stablecoin_mint` (ensure these are cloned in Anchor.toml)
const MAINNET_USDC_MINT_PUBKEY = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const MAINNET_USDT_MINT_PUBKEY = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

// Using method names as confirmed by the user or likely from Rust code
const initializeMethodName = "initialize";
const createPolicyMethodName = "createPolicy";
const depositCollateralMethodName = "depositCollateral"; // VERIFY THIS FROM YOUR IDL

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

    let policyIdCounter = 0;

    before(async () => {
        console.log("--- Global Test Setup ---");
        authoritySigner = (provider.wallet as anchor.Wallet).payer;
        buyer = Keypair.generate();
        underwriter = Keypair.generate();
        await airdropSol(provider, buyer.publicKey);
        await airdropSol(provider, underwriter.publicKey);

        // 1. Create Test Mint for USDC-like collateral/premiums (this will be our primary test USDC)
        testUsdcMintKeypair = Keypair.generate();
        testUsdcMintPublicKey = await splCreateMint(
            provider.connection, authoritySigner, authoritySigner.publicKey, null, TOKEN_DECIMALS, testUsdcMintKeypair
        );
        console.log(`Test USDC-like Mint (for main pool & premiums) created: ${testUsdcMintPublicKey.toBase58()}`);

        // 2. Create Test Mint for USDT-like collateral/premiums (this will be our primary test USDT)
        testUsdtMintKeypair = Keypair.generate();
        testUsdtMintPublicKey = await splCreateMint(
            provider.connection, authoritySigner, authoritySigner.publicKey, null, TOKEN_DECIMALS, testUsdtMintKeypair
        );
        console.log(`Test USDT-like Mint (for main pool & premiums) created: ${testUsdtMintPublicKey.toBase58()}`);

        // 3. Derive Global Pool Authority PDA
        [poolAuthorityPda] = PublicKey.findProgramAddressSync([AUTHORITY_SEED_BUF], program.programId);
        console.log(`Global Pool Authority PDA: ${poolAuthorityPda.toBase58()}`);

        // 4. Initialize Protocol for Test USDC-like collateral
        console.log("\nInitializing protocol for Test USDC-like collateral...");
        [usdcPoolLpMintPda] = PublicKey.findProgramAddressSync( // Renamed for clarity
            [LP_MINT_SEED_BUF, testUsdcMintPublicKey.toBuffer()], program.programId
        );
        [usdcPoolCollateralPda] = PublicKey.findProgramAddressSync( // Renamed for clarity
            [POOL_SEED_BUF, testUsdcMintPublicKey.toBuffer()], program.programId
        );
        await program.methods[initializeMethodName]()
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
        console.log(`Protocol initialized for Test USDC. LP Mint: ${usdcPoolLpMintPda.toBase58()}, Pool: ${usdcPoolCollateralPda.toBase58()}`);

        // 5. Initialize Protocol for Test USDT-like collateral
        console.log("\nInitializing protocol for Test USDT-like collateral...");
        [usdtPoolLpMintPda] = PublicKey.findProgramAddressSync( // Renamed for clarity
            [LP_MINT_SEED_BUF, testUsdtMintPublicKey.toBuffer()], program.programId
        );
        [usdtPoolCollateralPda] = PublicKey.findProgramAddressSync( // Renamed for clarity
            [POOL_SEED_BUF, testUsdtMintPublicKey.toBuffer()], program.programId
        );
        await program.methods[initializeMethodName]()
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
        console.log(`Protocol initialized for Test USDT. LP Mint: ${usdtPoolLpMintPda.toBase58()}, Pool: ${usdtPoolCollateralPda.toBase58()}`);

        // 6. Setup Buyer's ATAs and Mint Premium Tokens (using test mints)
        buyerTestUsdcAta = (await getOrCreateAssociatedTokenAccount(
            connection, authoritySigner, testUsdcMintPublicKey, buyer.publicKey
        )).address;
        await splMintTo(
            connection, authoritySigner, testUsdcMintPublicKey, buyerTestUsdcAta, authoritySigner,
            5000 * (10 ** TOKEN_DECIMALS)
        );
        console.log(`Minted 5000 test USDC-like tokens to buyer's premium ATA: ${buyerTestUsdcAta.toBase58()}`);

        buyerTestUsdtAta = (await getOrCreateAssociatedTokenAccount(
            connection, authoritySigner, testUsdtMintPublicKey, buyer.publicKey
        )).address;
        await splMintTo(
            connection, authoritySigner, testUsdtMintPublicKey, buyerTestUsdtAta, authoritySigner,
            5000 * (10 ** TOKEN_DECIMALS)
        );
        console.log(`Minted 5000 test USDT-like tokens to buyer's premium ATA: ${buyerTestUsdtAta.toBase58()}`);

        // 7. Setup Underwriter's ATA for Test USDC collateral and fund it
        underwriterTestUsdcAta = (await getOrCreateAssociatedTokenAccount(
            connection, authoritySigner, testUsdcMintPublicKey, underwriter.publicKey
        )).address;
        await splMintTo(
            connection, authoritySigner, testUsdcMintPublicKey, underwriterTestUsdcAta, authoritySigner,
            10000 * (10 ** TOKEN_DECIMALS) // Mint 10,000 test USDC for underwriter
        );
        console.log(`Minted 10000 test USDC-like tokens to underwriter's collateral ATA: ${underwriterTestUsdcAta.toBase58()}`);

        console.log("--- Global Setup Complete ---\n");
    });

    describe("Initialize Instruction Specific Tests", () => {
        // This test now uses a *third* distinct mint, different from testUsdcMintPublicKey and testUsdtMintPublicKey
        // to ensure the "initialize for a new collateral" logic is sound.
        let distinctTestMintKeypair: Keypair;
        let distinctTestMintPublicKey: PublicKey;

        before(async () => {
            distinctTestMintKeypair = Keypair.generate();
            distinctTestMintPublicKey = await splCreateMint(
                provider.connection, authoritySigner, authoritySigner.publicKey, null, TOKEN_DECIMALS, distinctTestMintKeypair
            );
            console.log(`Distinct Test Mint (for initialize tests) created: ${distinctTestMintPublicKey.toBase58()}`);
        });

        it("should initialize a new collateral for a distinct test token correctly", async () => {
            console.log(`\nInitializing for distinctTestMintPublicKey: ${distinctTestMintPublicKey.toBase58()}`);
            const [lpMintPda] = PublicKey.findProgramAddressSync(
                [LP_MINT_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
            );
            const [collateralTokenPoolPda] = PublicKey.findProgramAddressSync(
                [POOL_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
            );

            await program.methods[initializeMethodName]()
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
            console.log("Initialize for Distinct Test Mint: Assertions passed.");
        });

        it("should fail to re-initialize for the same distinct test collateral type", async () => {
            console.log(`\nAttempting to re-initialize for distinctTestMintPublicKey (should fail)...`);
            const [lpMintPda] = PublicKey.findProgramAddressSync(
                [LP_MINT_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
            );
            const [collateralTokenPoolPda] = PublicKey.findProgramAddressSync(
                [POOL_SEED_BUF, distinctTestMintPublicKey.toBuffer()], program.programId
            );

            try {
                await program.methods[initializeMethodName]()
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
                assert.fail("Should have failed to re-initialize for the same distinct collateral type.");
            } catch (error) {
                assert.isNotNull(error);
                const errorString = error.toString();
                assert.isTrue(
                    errorString.includes("custom program error: 0x0") ||
                    errorString.toLowerCase().includes("already in use") ||
                    errorString.toLowerCase().includes("already exists")
                );
                console.log("Re-initialize for Distinct Test Mint failed as expected.");
            }
        });
    });


    describe("Create Policy Instruction Specific Tests", () => {
        // Helper function for common create policy test logic
        async function testCreatePolicyScenario({
            testName,
            premiumPaymentMint,
            buyerPremiumAta,
            targetCollateralPool,
            insuredStablecoinOnPolicy,
            insuredAmountLamports = new BN(200 * (10 ** TOKEN_DECIMALS)),
            expectSuccess = true,
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

            console.log(`\nRunning test: "${testName}" (Policy ID: ${currentPolicyId})...`);
            console.log(`  Insured Amount: ${insuredAmountLamports.toString()}, Expected Premium: ${expectedPremiumLamports.toString()}`);

            let buyerInitialBalance = BigInt(0);
            let poolInitialBalance = BigInt(0);
            try {
                buyerInitialBalance = (await getAccount(connection, buyerPremiumAta)).amount;
                poolInitialBalance = (await getAccount(connection, targetCollateralPool)).amount;
                console.log(`  Buyer balance before: ${buyerInitialBalance.toString()}, Pool balance before: ${poolInitialBalance.toString()}`);
            } catch (e) {
                console.warn(`  Could not fetch initial balances: ${e.message}`);
            }

            try {
                await program.methods[createPolicyMethodName](insuredAmountLamports, currentPolicyId)
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

                if (!expectSuccess) {
                    assert.fail(`Test "${testName}" was expected to fail but succeeded.`);
                }
                console.log(`  RPC successful for "${testName}".`);

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

                if (expectedPremiumLamports.gtn(0)) {
                    const buyerFinalBalance = (await getAccount(connection, buyerPremiumAta)).amount;
                    const poolFinalBalance = (await getAccount(connection, targetCollateralPool)).amount;
                    assert.strictEqual(buyerInitialBalance - buyerFinalBalance, BigInt(expectedPremiumLamports.toString()), "Buyer premium deduction incorrect");
                    assert.strictEqual(poolFinalBalance - poolInitialBalance, BigInt(expectedPremiumLamports.toString()), "Pool premium addition incorrect");
                }
                console.log(`  Assertions passed for "${testName}".`);

            } catch (error) {
                if (expectSuccess) {
                    console.error(`  Error in "${testName}" (expected success):`, error.toString());
                    if (error.logs) console.error("  Logs:", error.logs.join("\n"));
                    assert.fail(`Test "${testName}" was expected to succeed but failed: ${error.toString()}`);
                } else {
                    console.log(`  Test "${testName}" (which expected failure or specific error) failed as anticipated or with a different error: ${error.toString()}`);
                }
            }
        }

        it("should successfully create a policy insuring USDC, premium in Test USDC", async () => {
            await testCreatePolicyScenario({
                testName: "USDC Insurance, Test USDC Premium",
                premiumPaymentMint: testUsdcMintPublicKey,
                buyerPremiumAta: buyerTestUsdcAta,
                targetCollateralPool: usdcPoolCollateralPda,
                insuredStablecoinOnPolicy: MAINNET_USDC_MINT_PUBKEY, // Insuring actual USDC
                expectSuccess: true,
            });
        });

        it("should successfully create a policy insuring USDT, premium in Test USDC", async () => {
            await testCreatePolicyScenario({
                testName: "USDT Insurance, Test USDC Premium",
                premiumPaymentMint: testUsdcMintPublicKey,
                buyerPremiumAta: buyerTestUsdcAta,
                targetCollateralPool: usdcPoolCollateralPda,
                insuredStablecoinOnPolicy: MAINNET_USDT_MINT_PUBKEY,
                expectSuccess: true,
            });
        });

        it("should successfully create a policy insuring USDT, premium in Test USDT", async () => {
            await testCreatePolicyScenario({
                testName: "USDT Insurance, Test USDT Premium",
                premiumPaymentMint: testUsdtMintPublicKey,
                buyerPremiumAta: buyerTestUsdtAta,
                targetCollateralPool: usdcPoolCollateralPda,
                insuredStablecoinOnPolicy: MAINNET_USDT_MINT_PUBKEY,
                expectSuccess: true,
            });
        });

        it("should fail if premium payment mint does not match collateral pool mint constraint", async () => {
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

            console.log(`\nRunning test: "Mismatched Premium Mint and Pool (Test USDT premium to Test USDC pool)" (should fail)...`);
            try {
                await program.methods[createPolicyMethodName](insuredAmountLamports, currentPolicyId)
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
                assert.isNotNull(error);
                // console.log("Mismatched mint raw error:", JSON.stringify(error, null, 2));
                if (error.error && error.error.errorCode && (error.error.errorCode.code === 2001 || error.error.errorCode.code === 2006)) {
                    // 2001 is ConstraintTokenMint, 2006 is ConstraintSeeds
                    // Either is acceptable here as the PDA for collateralTokenPool won't match if mint is different
                    assert.isTrue(error.error.errorCode.name === "ConstraintTokenMint" || error.error.errorCode.name === "ConstraintSeeds",
                        `Error name should be ConstraintTokenMint or ConstraintSeeds, but was ${error.error.errorCode.name}`);
                } else {
                    assert.fail(`Expected ConstraintTokenMint (2001) or ConstraintSeeds (2006) but got different error: ${error.toString()}`);
                }
                console.log(`  Failed with mismatched premium mint and pool, as expected.`);
            }
        });

        it("should fail for unsupported insured_stablecoin_mint (if validation added in Rust)", async () => {
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

            console.log(`\nRunning test: "Unsupported Insured Stablecoin" (should fail if Rust validation exists)...`);
            try {
                await program.methods[createPolicyMethodName](insuredAmountLamports, currentPolicyId)
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
                assert.isNotNull(error);
                // console.log("Unsupported stablecoin raw error:", JSON.stringify(error, null, 2));
                const expectedCustomErrorName = "UnsupportedStablecoinMint";

                if (error.error && error.error.errorCode) {
                    assert.strictEqual(error.error.errorCode.name, expectedCustomErrorName, `Expected error name ${expectedCustomErrorName}, got ${error.error.errorCode.name}`);
                } else {
                    assert.include(error.toString(), expectedCustomErrorName, `Error message should include ${expectedCustomErrorName}`);
                }
                console.log(`  Failed with unsupported insured_stablecoin_mint, as expected (if Rust validation is active).`);
            }
        });
    }); // End Create Policy Tests

    // ====== Deposit Collateral Instruction Tests ======
    describe("Deposit Collateral Instruction Tests", () => {
        let underwriterLpUsdcAta: PublicKey; // Underwriter's ATA for USDC-LP tokens (from testUsdcMintPublicKey pool)

        before(async () => {
            underwriterLpUsdcAta = (await getOrCreateAssociatedTokenAccount(
                connection,
                underwriter,
                usdcPoolLpMintPda, // LP mint for the pool initialized with testUsdcMintPublicKey
                underwriter.publicKey
            )).address;
            console.log(`\nUnderwriter's LP ATA for Test USDC Pool (usdcPoolLpMintPda): ${underwriterLpUsdcAta.toBase58()}`);
        });

        it("should allow an underwriter to make the first deposit into the Test USDC pool", async () => {
            const depositAmount = new BN(1000 * (10 ** TOKEN_DECIMALS));

            const initialLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
            const initialPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
            const underwriterInitialCollateral = (await getAccount(connection, underwriterTestUsdcAta)).amount;
            const initialUnderwriterLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;

            console.log(`\nCalling '${depositCollateralMethodName}' for first Test USDC deposit...`);
            await program.methods[depositCollateralMethodName](depositAmount)
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
            console.log(`'${depositCollateralMethodName}' for first Test USDC deposit successful.`);

            const finalLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
            const finalPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
            const underwriterFinalCollateral = (await getAccount(connection, underwriterTestUsdcAta)).amount;
            const underwriterLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;

            const expectedLpMinted = depositAmount;
            assert.ok(finalLpSupply === initialLpSupply + BigInt(expectedLpMinted.toString()), "LP supply incorrect after first deposit");
            assert.ok(finalPoolBalance === initialPoolBalance + BigInt(depositAmount.toString()), "Pool balance incorrect after first deposit");
            assert.ok(underwriterFinalCollateral === underwriterInitialCollateral - BigInt(depositAmount.toString()), "Underwriter collateral debited incorrectly");
            assert.ok(underwriterLpBalance === initialUnderwriterLpBalance + BigInt(expectedLpMinted.toString()), "Underwriter LP token balance incorrect after first deposit");
            console.log("First Test USDC Deposit: Assertions passed!");
        });

        it("should allow an underwriter to make a subsequent deposit into the Test USDC pool", async () => {
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

            console.log(`\nCalling '${depositCollateralMethodName}' for subsequent Test USDC deposit...`);
            console.log(`  Expected LP to mint (approx): ${expectedLpMintedSubsequent.toString()}`);

            await program.methods[depositCollateralMethodName](depositAmountSubsequent)
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
            console.log(`'${depositCollateralMethodName}' for subsequent Test USDC deposit successful.`);

            const finalLpSupply = (await getMint(connection, usdcPoolLpMintPda)).supply;
            const finalPoolBalance = (await getAccount(connection, usdcPoolCollateralPda)).amount;
            const underwriterFinalCollateral = (await getAccount(connection, underwriterTestUsdcAta)).amount;
            const underwriterLpBalance = (await getAccount(connection, underwriterLpUsdcAta)).amount;

            assert.ok(finalLpSupply === initialLpSupply + BigInt(expectedLpMintedSubsequent.toString()), "LP supply incorrect after subsequent deposit");
            assert.ok(finalPoolBalance === initialPoolBalance + BigInt(depositAmountSubsequent.toString()), "Pool balance incorrect after subsequent deposit");
            assert.ok(underwriterFinalCollateral === underwriterInitialCollateral - BigInt(depositAmountSubsequent.toString()), "Underwriter collateral debited incorrectly for subsequent deposit");
            assert.ok(underwriterLpBalance === underwriterInitialLpBalance + BigInt(expectedLpMintedSubsequent.toString()), "Underwriter LP token balance incorrect after subsequent deposit");
            console.log("Subsequent Test USDC Deposit: Assertions passed!");
        });

        it("should fail to deposit zero amount", async () => {
            const depositAmountZero = new BN(0);
            console.log(`\nCalling '${depositCollateralMethodName}' with zero amount (should fail)...`);
            try {
                await program.methods[depositCollateralMethodName](depositAmountZero)
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
                assert.isNotNull(error);
                const expectedErrorName = "CalculationError"; // Or "DepositTooSmallToMintLp" or "DepositAmountMustBePositive"
                if (error.error && error.error.errorCode) {
                    assert.strictEqual(error.error.errorCode.name, expectedErrorName, `Expected error ${expectedErrorName}, got ${error.error.errorCode.name}`);
                } else {
                    assert.include(error.toString(), expectedErrorName);
                }
                console.log("Failed to deposit zero amount, as expected.");
            }
        });
    });
});
