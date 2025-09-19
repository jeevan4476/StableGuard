# StableGuard 🛡️

[deployed link](https://explorer.solana.com/tx/3Ct5k9sAfbYedqHKzzYMCG7ywQ5NowXBYWYoE4cGxnaz7qT2XZb3PJVypW36YHHkipvu3jWxhUfLY9YnQZ3cNxK5?cluster=devnet)

Program Id : GdxAqJbfzhPCvtthZ563jyd4JVbAz58FoY5bRWCb5H8k [View](https://explorer.solana.com/address/GdxAqJbfzhPCvtthZ563jyd4JVbAz58FoY5bRWCb5H8k?cluster=devnet)

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
* Collateral provision  for underwriting.
* Fixed 7-day policy terms.
* Clear, objective depeg trigger using Pyth Network oracles.
* Automated, binary payout mechanism.
* Peer-to-Pool model for aggregated liquidity.

## Technology Stack

* **Blockchain:** Solana
* **Smart Contracts:** Anchor Framework
* **Oracle:** Pyth Network
* **Frontend:** Next.js (TBD)
* **Tokens:** SPL Tokens (USDC for premiums/collateral/payouts)

## Progress:-
* **Smartcontract** ✅
* **Testing** ✅
* **Frontend** 🏗️

For more Technical analysis vist Stableguard Blog:-
[Stableguard_notion](https://www.notion.so/StableGuard-1f1af37c754a8065a53bf578a5624459)

## MVP Enhancement & Core Stability 
* Focus: Refine existing MVP.
* Key Features:
    * Frontend improvements (UI/UX, basic analytics).
    * Additional testing and security hardening of existing contracts.
    * Begin research into dynamic premium models.

**Phase 1: Expanding Core Offerings**
* Focus: Introduce more flexibility and attract more users.
* Key Features:
    * Implement dynamic premiums (first iteration).
    * Offer variable policy terms.
    * Add support for 1-2 new, carefully vetted stablecoins.
    * Develop and launch an API for basic integrations.

**Phase 2: Advanced Features & Ecosystem Growth**
* Focus: Sophistication, composability, and decentralization.
* Key Features:
    * Explore tiered payout structures.
    * Develop initial DAO framework and governance token (if decided).
    * Research and potentially implement layered risk tranches for underwriters.
    * Begin exploring secondary markets for policies.

**Phase 3: Long-Term Vision & Sustainability**
* Focus: Becoming a foundational piece of DeFi risk management.
* Key Features:
    * Full DAO governance.
    * Cross-chain considerations.
    * Reinsurance mechanisms.
    * Continuous innovation based on market needs.
