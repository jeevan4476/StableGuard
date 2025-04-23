# StableGuard - Stablecoin Depeg Insurance Market

**Status:** Capstone Project - MVP Development

## Overview

StableGuard is a decentralized insurance protocol built on the Solana blockchain designed to address the systemic risk of stablecoin depegging events within the DeFi ecosystem. It provides a transparent, on-chain marketplace where users can hedge against the risk of major stablecoins (initially USDT and USDC) losing their peg, while liquidity providers can underwrite this risk to earn yield.

## Problem

Stablecoins like USDT and USDC are fundamental to DeFi, but the risk of them losing their $1 peg can cause significant disruption and financial loss. Accessible, transparent, and dedicated on-chain tools for hedging this specific risk are currently limited.

## Solution (MVP)

StableGuard offers fixed-term (e.g., 7-day) insurance policies against stablecoin depegs.

* **Buyers:** Purchase protection by paying a premium (USDC).
* **Underwriters:** Deposit collateral (USDC) into a shared pool to back policies and earn premiums.
* **Trigger:** A depeg event is defined by the stablecoin's price feed (via Pyth Network) falling below a predefined threshold (e.g., $0.985) at the exact policy expiry.
* **Payout:** If triggered, a fixed percentage (e.g., 10% binary payout) of the insured value is automatically paid out to the buyer in USDC from the collateral pool.

## Key Features (MVP)

* Insurance purchase for USDT & USDC on Solana.
* Collateral provision (USDC) for underwriting.
* Fixed 7-day policy terms.
* Clear, objective depeg trigger using Pyth Network oracles.
* Automated, binary payout mechanism.
* Peer-to-Pool model for aggregated liquidity.

## Technology Stack

* **Blockchain:** Solana
* **Smart Contracts:** Rust / Anchor Framework
* **Oracle:** Pyth Network
* **Frontend:** React / Next.js (TBD)
* **Tokens:** SPL Tokens (USDC for premiums/collateral/payouts)

