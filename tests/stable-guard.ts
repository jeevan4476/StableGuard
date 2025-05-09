import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StableGuard } from "../target/types/stable_guard";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
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

const airdrop = async (
  provider: anchor.AnchorProvider,
  to: anchor.web3.PublicKey,
  amount: number
) => {

  try {
    console.log(`Airdropping ${amount} SOL to ${to}`);
    const signature = await provider.connection.requestAirdrop(
      to,
      amount * anchor.web3.LAMPORTS_PER_SOL
    );
    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: signature
    }, "confirmed");
    console.log(`Airdrop successful: ${signature}`);
  } catch (error) {
    console.error(`Airdrop failed: ${error}`);
  }
}

describe("StableGuard", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const program = anchor.workspace.StableGuard as Program<StableGuard>;


  //seeds 
  const LP_MINT_SEED = Buffer.from("lp_mint");
  const POOL_SEED = Buffer.from("collateral_pool");
  const AUTHORITY_SEED = Buffer.from("pool_authority");

  let authoritySigner: Keypair; // Renamed for clarity, this is the payer for transactions
  let buyer: Keypair;
  let underwriter: Keypair;

  // PDAs - will be derived
  let lpMintPda: PublicKey;
  let collateralPoolUsdcAccountPda: PublicKey;
  let poolAuthorityPda: PublicKey;

  // Bumps for PDAs (optional to store, but good for context)
  // let lpMintBump: number;
  // let collateralPoolUsdcAccountBump: number;
  // let poolAuthorityBump: number;

  // Test USDC Mint
  let usdcMintKeypair: Keypair;
  let usdcMintPublicKey: PublicKey;

  before(async () => {
    authoritySigner = (provider.wallet as anchor.Wallet).payer;
    buyer = Keypair.generate();
    underwriter = Keypair.generate();

    await airdrop(provider, buyer.publicKey, 2);
    await airdrop(provider, underwriter.publicKey, 2);

    usdcMintKeypair = Keypair.generate();
    console.log(`Initializing test USDC mint with keypair: ${usdcMintKeypair.publicKey.toBase58()}`); usdcMintPublicKey = await splCreateMint(
      provider.connection,
      authoritySigner,
      authoritySigner.publicKey,
      null,
      6,
      usdcMintKeypair
    )
    console.log(`Test USDC mint created: ${usdcMintPublicKey.toBase58()}`);;

    [poolAuthorityPda] = PublicKey.findProgramAddressSync(
      [AUTHORITY_SEED],
      program.programId
    );
    [lpMintPda] = PublicKey.findProgramAddressSync(
      [LP_MINT_SEED],
      program.programId
    );
    [collateralPoolUsdcAccountPda] = PublicKey.findProgramAddressSync(
      [POOL_SEED, usdcMintPublicKey.toBuffer()],
      program.programId
    );
    console.log("--- Derived PDAs ---");
    console.log(`Pool Authority PDA: ${poolAuthorityPda.toBase58()}`);
    console.log(`LP Mint PDA: ${lpMintPda.toBase58()}`);
    console.log(`Collateral Pool USDC PDA: ${collateralPoolUsdcAccountPda.toBase58()}`);
    console.log("--- Setup Complete ---");
  })

  it("Should initialize the protocol correctly", async () => {
    const txhash = await program.methods.initialize()
      .accounts({
        authority: authoritySigner.publicKey,
        lpMint: lpMintPda,
        collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
        poolAuthority: poolAuthorityPda,
        usdcMint: usdcMintKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc({ skipPreflight: true });

    console.log(`Transaction hash: ${txhash}`);
    await provider.connection.confirmTransaction(
      txhash,
      "confirmed"
    );

    //check lp mint account
    const lpMintInfo = await getMint(
      provider.connection,
      lpMintPda
    )
    assert.strictEqual(lpMintInfo.mintAuthority.toBase58(), poolAuthorityPda.toBase58(), "LP Mint authority mismatch");
    assert.strictEqual(lpMintInfo.decimals, 6, "LP Mint decimals mismatch");
    assert.strictEqual(lpMintInfo.supply, BigInt(0), "LP Mint supply mismatch");

    //check collateral pool USDC pool
    const collateralPoolUsdcAccountInfo = await getAccount(
      provider.connection,
      collateralPoolUsdcAccountPda
    )

    assert.strictEqual(collateralPoolUsdcAccountInfo.mint.toBase58(), usdcMintKeypair.publicKey.toBase58(), "Collateral Pool USDC mint mismatch");
    assert.strictEqual(collateralPoolUsdcAccountInfo.owner.toBase58(), poolAuthorityPda.toBase58(), "Collateral Pool USDC owner mismatch");
    assert.strictEqual(collateralPoolUsdcAccountInfo.amount, BigInt(0), "Collateral Pool USDC amount mismatch");

    console.log("--- Initialization Complete ---");
  })

  it("should fail to initialize if alredy intialized", async () => {
    try {
      await program.methods.initialize()
        .accounts({
          authority: authoritySigner.publicKey,
          lpMint: lpMintPda,
          collateralPoolUsdcAccount: collateralPoolUsdcAccountPda,
          poolAuthority: poolAuthorityPda,
          usdcMint: usdcMintKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc({ skipPreflight: true });
      assert.fail("Should have failed to re-initialize the protocol.");
    } catch (error) {
      assert.isNotNull(error, "Expected an error during re-initialization.");
      console.log("Re-initialization failed as expected:", error.toString());
    }
  }
  )
});