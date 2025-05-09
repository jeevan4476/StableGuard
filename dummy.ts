import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StableGuard } from "../target/types/stable_guard";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import {
    createMint as splCreateMint,
    getAssociatedTokenAddressSync,
    mintToChecked as splMintToChecked,
    getOrCreateAssociatedTokenAccount,
    getMint,
    getAccount,
    Account,
    Mint as SplMintInfo
} from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";

const airdropSOL = async (
    to: anchor.web3.PublicKey,
    provider: anchor.AnchorProvider,
    amountSol: number
) => {
    try {
        const signature = await provider.connection.requestAirdrop(
            to,
            anchor.web3.LAMPORTS_PER_SOL * amountSol
        );
        const latestBlockhash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature: signature,
        }, "confirmed");
    } catch (e) {
        console.error(`Error airdropping SOL to ${to.toBase58()}: ${e}`);
    }
};

const createMintHelper = async (
    provider: anchor.AnchorProvider,
    mintKeypair: anchor.web3.Keypair,
    mintAuthority: anchor.web3.PublicKey,
    freezeAuthority: anchor.web3.PublicKey | null,
    decimals: number
) => {
    try {
        const mint = await splCreateMint(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            mintAuthority,
            freezeAuthority,
            decimals,
            mintKeypair
        );
        return mintKeypair.publicKey;
    } catch (e) {
        console.error(`Error creating Mint Account ${mintKeypair.publicKey.toBase58()}: ${e}`);
        throw e;
    }
};

const createAtaAndMintTokens = async (
    provider: anchor.AnchorProvider,
    mint: anchor.web3.PublicKey,
    owner: anchor.web3.Keypair,
    amountToMint: number,
    mintAuthorityKeypair: anchor.web3.Keypair
) => {
    try {
        const ata = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            owner,
            mint,
            owner.publicKey
        );
        await splMintToChecked(
            provider.connection,
            owner,
            mint,
            ata.address,
            mintAuthorityKeypair,
            amountToMint * Math.pow(10, 6),
            6
        );
        return ata.address;
    } catch (e) {
        console.error(`Error creating ATA and minting for mint ${mint.toBase58()}: ${e}`);
        throw e;
    }
};

const createMockPythFeed = async (
    provider: anchor.AnchorProvider,
    feedKeypair: anchor.web3.Keypair,
    price: number,
    expo: number,
    conf: number = 0
) => {
    const dataSize = 3312;
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(dataSize);
    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: (provider.wallet as anchor.Wallet).publicKey,
            newAccountPubkey: feedKeypair.publicKey,
            space: dataSize,
            lamports,
            programId: new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s"),
        })
    );
    await provider.sendAndConfirm(transaction, [feedKeypair]);
    return feedKeypair.publicKey;
};

const mintTokensHelper = async (
    provider: anchor.AnchorProvider,
    mint: anchor.web3.PublicKey,
    destinationAta: anchor.web3.PublicKey,
    authorityKeypair: anchor.web3.Keypair, // Keypair with Mint Authority
    amount: number // Amount in whole tokens (e.g., 1000 USDC)
) => {
    try {
        const decimals = 6; // Assuming 6 decimals for mock USDC/USDT
        const amountScaled = BigInt(amount * Math.pow(10, decimals));

        await splMintToChecked(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer, // Payer for the transaction fee
            mint,
            destinationAta,
            authorityKeypair, // Authority signing for the mint operation
            amountScaled,
            decimals
        );
        console.log(`Minted ${amount} tokens to ${destinationAta.toBase58()}`);
    } catch (e) {
        console.error(`Error minting tokens to ${destinationAta.toBase58()}: ${e}`);
        throw e;
    }
};

describe("stable-guard", () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.getProvider() as anchor.AnchorProvider;
    const connection = provider.connection;
    const program = anchor.workspace.StableGuard as Program<StableGuard>;

    let authorityKp: anchor.web3.Keypair;
    let buyerKp: anchor.web3.Keypair;
    let underwriterKp: anchor.web3.Keypair;

    let usdcMint: anchor.web3.PublicKey;
    let usdcMintKeypair: anchor.web3.Keypair;

    let lpMintPda: anchor.web3.PublicKey;
    let collateralPoolPda: anchor.web3.PublicKey;
    let poolAuthorityPda: anchor.web3.PublicKey;

    let testBuyerKp: Keypair;
    let testUnderwriterKp: Keypair;
    let testBuyerUsdcAta: PublicKey;
    let testUnderwriterUsdcAta: PublicKey;
    let testUnderwriterLpAta: PublicKey;
    let testPolicyId: anchor.BN;
    let testPolicyPda: PublicKey;
    let testMockPythFeedKp: Keypair;
    let testMockPythFeedAddress: PublicKey;

    beforeEach(async () => {
        // Use beforeEach to reset state for each check_and_payout test if needed,
        // or do a one-time setup in a nested describe's before block.
        console.log("Setting up for check_and_payout test...");

        // 1. Create fresh buyer and underwriter for isolation
        testBuyerKp = Keypair.generate();
        testUnderwriterKp = Keypair.generate();
        await airdropSOL(testBuyerKp.publicKey, provider, 1);
        await airdropSOL(testUnderwriterKp.publicKey, provider, 1);

        // 2. Create/Fund User ATAs
        // Buyer needs USDC to pay premium
        const buyerAtaInfo = await getOrCreateAssociatedTokenAccount(
            provider.connection, testBuyerKp, usdcMint, testBuyerKp.publicKey
        );
        testBuyerUsdcAta = buyerAtaInfo.address;
        await mintTokensHelper(provider, usdcMint, testBuyerUsdcAta, authorityKp, 100); // Mint 100 USDC

        // Underwriter needs USDC to deposit collateral
        const underwriterAtaInfo = await getOrCreateAssociatedTokenAccount(
            provider.connection, testUnderwriterKp, usdcMint, testUnderwriterKp.publicKey
        );
        testUnderwriterUsdcAta = underwriterAtaInfo.address;
        await mintTokensHelper(provider, usdcMint, testUnderwriterUsdcAta, authorityKp, 5000); // Mint 5000 USDC

        // Underwriter needs an LP token account (init_if_needed handles this in deposit)
        testUnderwriterLpAta = getAssociatedTokenAddressSync(lpMintPda, testUnderwriterKp.publicKey);

        // 3. Underwriter deposits collateral
        const depositAmount = new anchor.BN(2000 * 1_000_000); // Deposit 2000 USDC
        await program.methods.depositCollateral(depositAmount)
            .accounts({
                underwriter: testUnderwriterKp.publicKey,
                underwriterUsdcAccount: testUnderwriterUsdcAta,
                underwriterLpTokenAccount: testUnderwriterLpAta, // init_if_needed will create this
                collateralPoolUsdcAccount: collateralPoolPda,
                lpMint: lpMintPda,
                poolAuthority: poolAuthorityPda,
                usdcMint: usdcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .signers([testUnderwriterKp])
            .rpc({ skipPreflight: true });
        console.log("Underwriter deposited collateral.");

        // 4. Buyer creates a policy
        testPolicyId = new anchor.BN(Date.now()); // Use timestamp for unique ID in test
        const insuredAmountNum = 1000;
        const decimals = 6;
        const insuredAmount = new anchor.BN(insuredAmountNum * Math.pow(10, decimals));

        [testPolicyPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("policy"), testBuyerKp.publicKey.toBuffer(), testPolicyId.toBuffer('le', 8)],
            program.programId
        );

        await program.methods.createPolicy(insuredAmount, testPolicyId)
            .accounts({
                buyer: testBuyerKp.publicKey,
                policyAccount: testPolicyPda,
                buyerUsdcAccount: testBuyerUsdcAta,
                collateralPoolUsdcAccount: collateralPoolPda,
                usdcMint: usdcMint,
                insuredStablecoinMint: usdcMint, // Insuring USDC in this test
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([testBuyerKp])
            .rpc({ skipPreflight: true });
        console.log(`Policy ${testPolicyId.toString()} created at PDA ${testPolicyPda.toBase58()}`);

        // 5. Create Mock Pyth Feed Account (Data will be set in specific tests)
        testMockPythFeedKp = Keypair.generate();
        testMockPythFeedAddress = await createMockPythFeed(
            provider,
            testMockPythFeedKp,
            1_00000000, // Default price $1.00
            -8 // Default expo
            // Confidence/Timestamp set per test
        );
        console.log(`Mock Pyth Feed created at ${testMockPythFeedAddress.toBase58()}`);

    });


    it("Should payout correctly when depeg condition is met at expiry", async () => {
        console.log("Test: Payout on Depeg");

        // --- Test Setup ---
        // 1. Get Policy Details (optional, but good for reference)
        const policyInfo = await program.account.policyAccount.fetch(testPolicyPda);
        const expiryTimestamp = policyInfo.expiryTimestamp.toNumber();
        const expectedPayout = policyInfo.payoutAmount; // Get pre-calculated payout

        // 2. Simulate Time Passing (Fast forward clock if using local validator)
        // This is HARD on live Devnet. On localnet, you can sometimes warp time.
        // For now, we'll assume enough time passes OR we adjust expiry in create_policy for testing.
        // A simpler test approach might be to create the policy with an expiry in the past.
        // Let's assume expiry has passed for this test logic.
        const currentTime = Math.floor(Date.now() / 1000);
        // assert(currentTime >= expiryTimestamp, "Test setup error: Policy should be expired");

        // 3. Set Mock Pyth Data for DEPEG scenario
        const depegPrice = new anchor.BN(98_000_000); // $0.980 (Below $0.985 threshold), assuming 8 decimals for comparison
        const priceExpo = -8;
        const confidence = new anchor.BN(1000); // Low confidence value, should pass check
        const publishTime = new anchor.BN(currentTime); // Fresh price

        // ** ACTION NEEDED: Implement helper to write this data to testMockPythFeedAddress **
        // await updateMockPythFeed(provider, testMockPythFeedKp, depegPrice, priceExpo, confidence, publishTime);
        console.log(`Setting mock Pyth price to ${depegPrice} * 10^${priceExpo}`);
        // !!! Skipping actual data write for now - THIS IS WHERE MOCKING IS NEEDED !!!
        // Without writing data, the check_and_payout call below will likely fail
        // when trying to deserialize the empty mock Pyth account.

        // 4. Get balances before payout
        const buyerUsdcBalanceBefore = (await getAccount(provider.connection, testBuyerUsdcAta)).amount;
        const poolUsdcBalanceBefore = (await getAccount(provider.connection, collateralPoolPda)).amount;

        // --- Execute Instruction ---
        console.log("Calling check_and_payout...");
        try {
            await program.methods
                .checkAndPayout(testPolicyId) // Pass policy ID
                .accounts({
                    buyer: testBuyerKp.publicKey,
                    policyAccount: testPolicyPda,
                    collateralPoolUsdcAccount: collateralPoolPda,
                    poolAuthority: poolAuthorityPda,
                    buyerUsdcAccount: testBuyerUsdcAta,
                    usdcMint: usdcMint,
                    pythPriceFeed: testMockPythFeedAddress, // Use the MOCK feed address
                    tokenProgram: TOKEN_PROGRAM_ID,
                    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                })
                .signers([testBuyerKp]) // Buyer signs to trigger check
                .rpc({ skipPreflight: true });
            console.log("check_and_payout called successfully.");
        } catch (error) {
            console.error("Error calling check_and_payout:", error);
            // Log details if possible
            if (error.logs) { console.error("Logs:", error.logs); }
            // If data wasn't written to mock Pyth account, expect deserialization error here
            assert.fail(`check_and_payout instruction failed: ${error}`);
        }

        // --- Assertions ---
        console.log("Fetching accounts after check_and_payout...");
        const policyInfoAfter = await program.account.policyAccount.fetch(testPolicyPda);
        const buyerUsdcInfoAfter = await getAccount(provider.connection, testBuyerUsdcAta);
        const poolUsdcInfoAfter = await getAccount(provider.connection, collateralPoolPda);

        // Check policy status
        assert.equal(Object.keys(policyInfoAfter.status)[0].toLowerCase(), 'expiredpaid', "Policy status should be ExpiredPaid");

        // Check balances
        const expectedBuyerBalanceAfter = buyerUsdcBalanceBefore + BigInt(expectedPayout.toString());
        const expectedPoolBalanceAfter = poolUsdcBalanceBefore - BigInt(expectedPayout.toString());

        assert.strictEqual(buyerUsdcInfoAfter.amount, expectedBuyerBalanceAfter, "Buyer USDC balance incorrect after payout");
        assert.strictEqual(poolUsdcInfoAfter.amount, expectedPoolBalanceAfter, "Pool USDC balance incorrect after payout");

        console.log("Payout on Depeg test passed!");
    });

    it("Should not payout when depeg condition is NOT met at expiry", async () => {
        console.log("Test: No Payout on No Depeg");

        // --- Test Setup ---
        // Assumes policy, ATAs etc exist from beforeEach or previous setup

        // 1. Simulate Time Passing (Assume policy is expired)
        const currentTime = Math.floor(Date.now() / 1000);

        // 2. Set Mock Pyth Data for NO DEPEG scenario
        const stablePrice = new anchor.BN(99_800_000); // $0.998 (Above $0.985 threshold)
        const priceExpo = -8;
        const confidence = new anchor.BN(1000);
        const publishTime = new anchor.BN(currentTime);

        // ** ACTION NEEDED: Implement helper to write this data to testMockPythFeedAddress **
        // await updateMockPythFeed(provider, testMockPythFeedKp, stablePrice, priceExpo, confidence, publishTime);
        console.log(`Setting mock Pyth price to ${stablePrice} * 10^${priceExpo}`);
        // !!! Skipping actual data write for now - THIS IS WHERE MOCKING IS NEEDED !!!

        // 3. Get balances before check
        const buyerUsdcBalanceBefore = (await getAccount(provider.connection, testBuyerUsdcAta)).amount;
        const poolUsdcBalanceBefore = (await getAccount(provider.connection, collateralPoolPda)).amount;

        // --- Execute Instruction ---
        console.log("Calling check_and_payout...");
        try {
            await program.methods
                .checkAndPayout(testPolicyId) // Pass policy ID
                .accounts({
                    buyer: testBuyerKp.publicKey,
                    policyAccount: testPolicyPda,
                    collateralPoolUsdcAccount: collateralPoolPda,
                    poolAuthority: poolAuthorityPda,
                    buyerUsdcAccount: testBuyerUsdcAta,
                    usdcMint: usdcMint,
                    pythPriceFeed: testMockPythFeedAddress, // Use the MOCK feed address
                    tokenProgram: TOKEN_PROGRAM_ID,
                    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                })
                .signers([testBuyerKp])
                .rpc({ skipPreflight: true });
            console.log("check_and_payout called successfully.");
        } catch (error) {
            console.error("Error calling check_and_payout:", error);
            if (error.logs) { console.error("Logs:", error.logs); }
            assert.fail(`check_and_payout instruction failed: ${error}`);
        }

        // --- Assertions ---
        console.log("Fetching accounts after check_and_payout...");
        const policyInfoAfter = await program.account.policyAccount.fetch(testPolicyPda);
        const buyerUsdcInfoAfter = await getAccount(provider.connection, testBuyerUsdcAta);
        const poolUsdcInfoAfter = await getAccount(provider.connection, collateralPoolPda);

        // Check policy status
        assert.equal(Object.keys(policyInfoAfter.status)[0].toLowerCase(), 'expirednotpaid', "Policy status should be ExpiredNotPaid");

        // Check balances (should be unchanged)
        assert.strictEqual(buyerUsdcInfoAfter.amount, buyerUsdcBalanceBefore, "Buyer USDC balance should not change");
        assert.strictEqual(poolUsdcInfoAfter.amount, poolUsdcBalanceBefore, "Pool USDC balance should not change");

        console.log("No Payout on No Depeg test passed!");
    })
});