// File: tests/helpers.ts

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, StakeAuthorizationLayout } from "@solana/web3.js";
import {StableGuard}  from "../target/types/stable_guard";

// Re-export constants for easy access in test files
export const CONSTANTS = {
  INSURANCE_POOL_SEED: Buffer.from("insurance_pool"),
  LP_MINT_SEED: Buffer.from("lp_mint"),
  POOL_SEED: Buffer.from("collateral_pool"),
  AUTHORITY_SEED: Buffer.from("pool_authority"),
};

// --- PDA Finder Functions ---

export function findInsurancePoolPda(collateralMint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [CONSTANTS.INSURANCE_POOL_SEED, collateralMint.toBuffer()],
    StableGuard.programId
  );
  return pda;
}

export function findLpMintPda(collateralMint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [CONSTANTS.LP_MINT_SEED, collateralMint.toBuffer()],
    StableGuard.programId
  );
  return pda;
}

export function findCollateralPoolPda(collateralMint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [CONSTANTS.POOL_SEED, collateralMint.toBuffer()],
    StableGuard.programId
  );
  return pda;
}

export function findPoolAuthorityPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [CONSTANTS.AUTHORITY_SEED],
    StableGuard.programId
  );
  return pda;
}