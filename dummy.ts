// pub use crate:: constants;
// use crate:: {
//     error:: StableGuardError, PolicyAccount, PolicyStatus, SECONDS_30, USDC_MINT_PUBKEY,
//         USDT_MINT_PUBKEY,
// };
// use anchor_lang:: prelude::*;
// use anchor_spl:: token:: { transfer_checked, Mint, Token, TokenAccount, TransferChecked };
// use pyth_solana_receiver_sdk:: price_update:: { get_feed_id_from_hex, PriceUpdateV2 };

// #[derive(Accounts)]
// #[instruction(policy_id: u64)]
// pub struct CheckAndPayout < 'info> {
//     #[account(mut)]
//     pub buyer: Signer < 'info>,
//     #[account(
//             mut,
//             seeds = [constants:: POLICY_SEED, buyer.key().as_ref(), policy_id.to_le_bytes().as_ref()],
//             bump = policy_account.bump,
//             has_one = buyer
//         )]
//     pub policy_account: Account < 'info, PolicyAccount>,
//     #[account(
//             mut,
//             seeds = [constants:: POOL_SEED, mint.key().as_ref()],
//             bump
//         )]
//     pub collateral_token_pool: Account < 'info, TokenAccount>,
//     /// CHECK: this is safe
//     #[account(
//             seeds = [constants:: AUTHORITY_SEED],
//             bump
//         )]
//     pub pool_authority: AccountInfo < 'info>,
//     #[account(
//             mut,
//             token:: mint = mint,
//             token:: authority = policy_account.buyer
//         )]
//     pub buyer_token_account: Account < 'info, TokenAccount>,
//     #[account(
//             address = collateral_token_pool.mint
//         )]
//     pub mint: Account < 'info, Mint>,
//     pub pyth_price_update: Account < 'info, PriceUpdateV2>,
//     pub token_program: Program < 'info, Token>,
// }

// impl < 'info> CheckAndPayout<'info > {
//     pub fn check_payout(&mut self, policy_id: u64, bumps: & CheckAndPayoutBumps) -> Result < () > {
//         let policy = & mut self.policy_account;
//         let pyth_feed_account_info = & self.pyth_price_update;
//         let maximum_age: u64 = SECONDS_30;

//         require!(
//             policy.status == PolicyStatus:: Active,
//         StableGuardError:: PolicyAlreadyProcessed
//         );
//         require!(
//             Clock:: get()?.unix_timestamp >= policy.expiry_timestamp,
//     StableGuardError:: PolicyNotExpired
//         );

// // let current_pyth_time = Clock::get()?.unix_timestamp;
// let relevant_feed_id: & str = match policy.insured_stablecoin_mint {
//     key if key == constants:: USDC_MINT_PUBKEY => {
//         "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
//     }
//             key if key == constants:: USDT_MINT_PUBKEY => {
//     "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b"
// }
// _ => return err!(StableGuardError:: InvalidStablecoinMint),
//         };

// // require_keys_eq!(
// //     self.pyth_price_update.key(),
// //     expected_pyth_feed_address,
// //     StableGuardError::InvalidPythAccount
// // );

// // let usdc_feed_id: [u8; 32] = get_feed_id_from_hex(
// //     "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
// // )?;
// // let usdc_price = self.pyth_price_update.get_price_no_older_than(
// //     &Clock::get()?,
// //     maximum_age,
// //     &usdc_feed_id,
// // )?;
// // msg!(
// //     "The price USDC is {} * 10^{}",
// //     usdc_price.price,
// //     usdc_price.exponent
// // );
// // let usdt_feed_id: [u8; 32] = get_feed_id_from_hex(
// //     "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
// // )?;
// // let usdt_price = self.pyth_price_update.get_price_no_older_than(
// //     &Clock::get()?,
// //     maximum_age,
// //     &usdt_feed_id,
// // )?;
// // msg!(
// //     "The price USDC is {} * 10^{}",
// //     usdt_price.price,
// //     usdt_price.exponent
// // );

// // let relevant_feed_id: &str = match policy.insured_stablecoin_mint {
// //     k if k == USDC_MINT_PUBKEY => {
// //         "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
// //     }
// //     k if k == USDT_MINT_PUBKEY => {
// //         "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b"
// //     }
// //     _ => return err!(StableGuardError::InsufficientLpTokensToBurn),
// // };

// let feed_id: [u8; 32] = get_feed_id_from_hex(relevant_feed_id) ?;

// let price_data = pyth_feed_account_info.get_price_no_older_than(
//             & Clock:: get() ?,
//     maximum_age,
//             & feed_id,
// ) ?;

// msg!(
//     "Price for feed {} is {} * 10^{}",
//     relevant_feed_id,
//     price_data.price,
//     price_data.exponent
// );

// //price_data contains price(i64) expo(i32) confidence(u64)
// require!(
//     price_data.conf < constants:: MAX_CONFIDENCE_VALUE,
//     StableGuardError:: OracleConfidenceTooWide
// );

// let pyth_mantissa = price_data.price;

// let pyth_exponent = price_data.exponent;

// const TARGET_DECIMALS: i32 = 8;
// // If pyth_exponent is -8 and TARGET_DECIMALS is 8, we need to multiply by 10^(8-8) = 10^0 = 1.

// let scaled_pyth_price: i64;

// if pyth_exponent > 0 {
//     return err!(StableGuardError:: OracleExponentUnexpected);
// }
// let scale_difference = pyth_exponent - (-TARGET_DECIMALS);

// if scale_difference > 0 {
//     let multiplier = 10u64.pow(scale_difference as u32) as i64;
//     scaled_pyth_price = pyth_mantissa
//         .checked_mul(multiplier)
//         .ok_or(StableGuardError:: CalculationError) ?;
// } else if scale_difference < 0 {
//     let divisor = 10u64.pow((-scale_difference) as u32) as i64;
//     require!(divisor != 0, StableGuardError:: CalculationError);
//     scaled_pyth_price = pyth_mantissa
//         .checked_div(divisor)
//         .ok_or(StableGuardError:: CalculationError) ?;
// } else {
//     scaled_pyth_price = pyth_mantissa;
// }

// if scaled_pyth_price < constants:: DEPEG_THRESHOLD_PRICE as i64 {
//     //DEPEG condition met

//     let payout_amt_to_transfer = policy.payout_amount;

//     let collateral_pool = & mut self.collateral_token_pool;

//     require!(
//         collateral_pool.amount >= payout_amt_to_transfer,
//         StableGuardError:: InsufficientPoolCollateralForPayout
//     );

//     let authority_seeds_bump = bumps.pool_authority;
//     let authority_seeds = & [constants:: AUTHORITY_SEED, & [authority_seeds_bump]];
//     let signer_seeds = & [& authority_seeds[..]];

//     let transfer_payout_accounts = TransferChecked {
//         from: collateral_pool.to_account_info(),
//             mint: self.mint.to_account_info(),
//                 to: self.buyer_token_account.to_account_info(),
//                     authority: self.pool_authority.to_account_info(),
//             };

// let cpi_ctx = CpiContext:: new_with_signer(
//     self.token_program.to_account_info(),
//     transfer_payout_accounts,
//     signer_seeds,
//             );

// transfer_checked(cpi_ctx, payout_amt_to_transfer, self.mint.decimals) ?;
// policy.status = PolicyStatus:: ExpiredPaid;
// Ok(())
//         } else {
//     //No DEPEG
//     self.policy_account.status = PolicyStatus:: ExpiredNotPaid;
//     Ok(())
// }
//     }
// }

//---------------------------------------//
// import * as anchor from "@coral-xyz/anchor";
// import { Program, BN } from "@coral-xyz/anchor";
// import { StableGuard } from "../target/types/stable_guard";
// import {
//   TOKEN_PROGRAM_ID,
//   getMint,
//   getAccount,
//   createMint as splCreateMint,
// } from "@solana/spl-token";
// import {
//   Keypair,
//   PublicKey,
//   SystemProgram,
//   LAMPORTS_PER_SOL,
// } from "@solana/web3.js";
// import { assert } from "chai";

// async function airdropSol(
//   provider: anchor.AnchorProvider,
//   targetPublicKey: PublicKey,
//   lamports: number = 2 * LAMPORTS_PER_SOL
// ) {
//   try {
//     const signature = await provider.connection.requestAirdrop(targetPublicKey, lamports);
//     const latestBlockHash = await provider.connection.getLatestBlockhash();
//     await provider.connection.confirmTransaction({
//       blockhash: latestBlockHash.blockhash,
//       lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
//       signature: signature,
//     }, "confirmed");
//     return signature;
//   } catch (error) {
//     console.warn(`Airdrop to ${targetPublicKey.toBase58()} failed. They might already have funds or be rate-limited. Error: ${error.message}`);
//     return "";
//   }
// }

// const LP_MINT_SEED_BUF = Buffer.from("lp_mint");
// const POOL_SEED_BUF = Buffer.from("collateral_pool");
// const AUTHORITY_SEED_BUF = Buffer.from("pool_authority");
// const TOKEN_DECIMALS = 6;
// const PREMIUM_RATE_BPS_VAL = 50;
// const BINARY_PAYOUT_BPS_VAL = 1000;
// const POLICY_TERM_SECONDS = 7 * 24 * 60 * 60;

// // Mainnet mints (ensure these are cloned in Anchor.toml)
// const MAINNET_USDC_MINT_PUBKEY = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
// const MAINNET_USDT_MINT_PUBKEY = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

// describe("StableGuard", () => {
//   anchor.setProvider(anchor.AnchorProvider.env());
//   const provider = anchor.getProvider() as anchor.AnchorProvider;
//   const connection = provider.connection;
//   const program = anchor.workspace.StableGuard as Program<StableGuard>;

//   let authoritySigner: Keypair;
//   let testCollateralMint1Keypair: Keypair;
//   let testCollateralMint1PublicKey: PublicKey;
//   let poolAuthorityPda: PublicKey;


//   before(async () => {
//     authoritySigner = (provider.wallet as anchor.Wallet).payer;
//     testCollateralMint1Keypair = Keypair.generate();
//     testCollateralMint1PublicKey = await splCreateMint(
//       provider.connection,
//       authoritySigner,
//       authoritySigner.publicKey,
//       null,
//       TOKEN_DECIMALS,
//       testCollateralMint1Keypair
//     );
//     [poolAuthorityPda] = PublicKey.findProgramAddressSync(
//       [AUTHORITY_SEED_BUF], program.programId
//     );
//   });


//   it("should initialize a new collateral for a token eg.(USDC) correctly", async () => {
//     const [lpMintPdaForMint1] = PublicKey.findProgramAddressSync(
//       [LP_MINT_SEED_BUF, testCollateralMint1PublicKey.toBuffer()], program.programId
//     );
//     const [collateralTokenPoolPdaForMint1] = PublicKey.findProgramAddressSync(
//       [POOL_SEED_BUF, testCollateralMint1PublicKey.toBuffer()], program.programId
//     );

//     await program.methods.initialize()
//       .accounts({
//         authority: authoritySigner.publicKey,
//         lpMint: lpMintPdaForMint1,
//         collateralTokenPool: collateralTokenPoolPdaForMint1,
//         poolAuthority: poolAuthorityPda,
//         mint: testCollateralMint1PublicKey,
//         systemProgram: SystemProgram.programId,
//         tokenProgram: TOKEN_PROGRAM_ID,
//       })
//       .rpc();

//     const lpMintInfo = await getMint(provider.connection, lpMintPdaForMint1);
//     assert.strictEqual(lpMintInfo.mintAuthority.toBase58(), poolAuthorityPda.toBase58());
//     assert.strictEqual(lpMintInfo.decimals, TOKEN_DECIMALS);
//     assert.strictEqual(lpMintInfo.supply, BigInt(0));

//     const collateralPoolInfo = await getAccount(provider.connection, collateralTokenPoolPdaForMint1);
//     assert.strictEqual(collateralPoolInfo.mint.toBase58(), testCollateralMint1PublicKey.toBase58());
//     assert.strictEqual(collateralPoolInfo.owner.toBase58(), poolAuthorityPda.toBase58());
//     assert.strictEqual(collateralPoolInfo.amount, BigInt(0));
//   });

//   it("should fail to re-initialize for the same collateral type (Mint 1)", async () => {
//     const [lpMintPdaForMint1] = PublicKey.findProgramAddressSync(
//       [LP_MINT_SEED_BUF, testCollateralMint1PublicKey.toBuffer()], program.programId
//     );
//     const [collateralTokenPoolPdaForMint1] = PublicKey.findProgramAddressSync(
//       [POOL_SEED_BUF, testCollateralMint1PublicKey.toBuffer()], program.programId
//     );

//     try {
//       await program.methods.initialize()
//         .accounts({
//           authority: authoritySigner.publicKey,
//           lpMint: lpMintPdaForMint1,
//           collateralTokenPool: collateralTokenPoolPdaForMint1,
//           poolAuthority: poolAuthorityPda,
//           mint: testCollateralMint1PublicKey,
//           systemProgram: SystemProgram.programId,
//           tokenProgram: TOKEN_PROGRAM_ID,
//         })
//         .rpc();
//       assert.fail("Should have failed to re-initialize for the same collateral type.");
//     } catch (error) {
//       assert.isNotNull(error);
//       const errorString = error.toString();
//       assert.isTrue(
//         errorString.includes("custom program error: 0x0") ||
//         errorString.toLowerCase().includes("already in use") ||
//         errorString.toLowerCase().includes("already exists")
//       );
//     }
//   });

//   it("should successfully initialize for a collateral type/token eg.(USDT)", async () => {
//     const testCollateralMint2Keypair = Keypair.generate();
//     const testCollateralMint2PublicKey = await splCreateMint(
//       provider.connection,
//       authoritySigner,
//       authoritySigner.publicKey,
//       null,
//       TOKEN_DECIMALS,
//       testCollateralMint2Keypair
//     );

//     const [lpMintPdaForMint2] = PublicKey.findProgramAddressSync(
//       [LP_MINT_SEED_BUF, testCollateralMint2PublicKey.toBuffer()], program.programId
//     );
//     const [collateralTokenPoolPdaForMint2] = PublicKey.findProgramAddressSync(
//       [POOL_SEED_BUF, testCollateralMint2PublicKey.toBuffer()], program.programId
//     );

//     await program.methods.initialize()
//       .accounts({
//         authority: authoritySigner.publicKey,
//         lpMint: lpMintPdaForMint2,
//         collateralTokenPool: collateralTokenPoolPdaForMint2,
//         poolAuthority: poolAuthorityPda,
//         mint: testCollateralMint2PublicKey,
//         systemProgram: SystemProgram.programId,
//         tokenProgram: TOKEN_PROGRAM_ID,
//       })
//       .rpc();

//     const newLpMintInfo = await getMint(provider.connection, lpMintPdaForMint2);
//     assert.strictEqual(newLpMintInfo.mintAuthority.toBase58(), poolAuthorityPda.toBase58());
//     assert.strictEqual(newLpMintInfo.decimals, TOKEN_DECIMALS);
//     assert.strictEqual(newLpMintInfo.supply, BigInt(0));

//     const newCollateralPoolInfo = await getAccount(provider.connection, collateralTokenPoolPdaForMint2);
//     assert.strictEqual(newCollateralPoolInfo.mint.toBase58(), testCollateralMint2PublicKey.toBase58());
//     assert.strictEqual(newCollateralPoolInfo.owner.toBase58(), poolAuthorityPda.toBase58());
//     assert.strictEqual(newCollateralPoolInfo.amount, BigInt(0));

//     const [lpMintPdaForMint1] = PublicKey.findProgramAddressSync(
//       [LP_MINT_SEED_BUF, testCollateralMint1PublicKey.toBuffer()], program.programId
//     );
//     const [collateralTokenPoolPdaForMint1] = PublicKey.findProgramAddressSync(
//       [POOL_SEED_BUF, testCollateralMint1PublicKey.toBuffer()], program.programId
//     );

//     assert.notEqual(lpMintPdaForMint1.toBase58(), lpMintPdaForMint2.toBase58());
//     assert.notEqual(collateralTokenPoolPdaForMint1.toBase58(), collateralTokenPoolPdaForMint2.toBase58());
//   });
// });
