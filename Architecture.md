#StableGuard 

Architecture Design 
1. Protocol MVP Requirements:

    The protocol shall allow a user (Buyer) to purchase fixed-term (7-day) insurance policies for USDT (on Solana).
    
    The protocol shall allow a user (Buyer) to purchase fixed-term (7-day) insurance policies for USDC (on Solana).
    
    The protocol shall use the Pyth Network price feed to determine the stablecoin price at policy expiry.
    
    The protocol shall define a depeg event as the relevant Pyth price feed being below $0.985 at the exact policy expiry timestamp.
    
    The protocol shall automatically pay out a fixed percentage (e.g., 10% binary) of the insured nominal value in USDC if a depeg event is triggered at expiry.
    
    The protocol shall allow users (Underwriters/LPs) to deposit USDC collateral into a shared pool to back insurance policies.
    
    The protocol shall collect premiums (in USDC) from Buyers upon policy purchase.
    
    The protocol shall distribute collected premiums to Underwriters proportionally to their share of the collateral pool (mechanism details TBD in implementation, may be via withdrawal).
    
    The protocol shall allow Underwriters to withdraw their deposited USDC collateral and accrued earnings, subject to defined conditions (e.g., lockups, pool health).  

2. High-Level Architecture Diagram (MVP):

This diagram shows the primary components, their interactions, and key account types.

```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#333333',
      'lineColor': '#666666',
      'textColor': '#333333',
      'fontSize': '14px',
      'nodeBorder': '#666666',
      'mainBkg': '#ffffff',
      'clusterBkg': '#f4f4f4'
    }
  }
}%%
graph TD
    %% Define Styles
    classDef pgm fill:#D5A6BD,stroke:#333,stroke-width:2px,color:#333;
    classDef cpm fill:#A6D5BD,stroke:#333,stroke-width:2px,color:#333;
    classDef spl fill:#A6BDD5,stroke:#333,stroke-width:2px,color:#333;
    classDef pda fill:#E0E0E0,stroke:#666,stroke-width:1px,stroke-dasharray: 5 5,color:#333;
    classDef oracle fill:#f90,stroke:#333,stroke-width:2px,color:#333;
    classDef userLayer fill:#f4f4f4,stroke:#bbb;
    classDef solanaLayer fill:#f4f4f4,stroke:#bbb;
    classDef externalLayer fill:#f4f4f4,stroke:#bbb;

    %% User Interaction Layer
    subgraph userLayer [User Interaction Layer]
        U["User (Buyer/Underwriter)"] --> FE["Frontend dApp (React/Next.js)"];
        FE --- Wallet["Wallet Extension"];
        FE -- "Sends Transactions & Reads Data" --> RPC["Solana RPC Node"];
    end

    %% Solana On-Chain Layer
    subgraph solanaLayer [Solana On-Chain Layer]
        RPC -- "Calls Program Instructions" --> PGM;
        RPC -- "Calls Program Instructions" --> CPM;
        RPC -- "Reads Account Data" --> PA;
        RPC -- "Reads Account Data" --> CPA;

        PGM["Policy Manager Program"]:::pgm;
        CPM["Collateral Pool Program"]:::cpm;
        SPL["SPL Token Program"]:::spl;

        PGM -- "Manages Lifecycle" --> PA["Policy Accounts (PDAs)"]:::pda;
        CPM -- "Manages Funds" --> CPA["Collateral Pool Token Account (PDA - Holds USDC)"]:::pda;

        PGM -- "CPI: Transfer Premium" --> SPL;
        CPM -- "CPI: Transfer Collateral/Payouts/Withdrawals" --> SPL;

        CPM -- "Reads Price Data" --> Oracle_Ref(["Pyth Network Oracle"]);
    end

    %% External Dependencies Layer
    subgraph externalLayer [External Dependencies]
         Oracle_Ref -- "Provides Price Feeds" --> CPM;
    end

    %% Link Wallet to User Account (Implicit)
    Wallet --> UserAcct["User's USDC Wallet Account"];
    UserAcct -- "Funds" --> SPL;

```

3. Explanation of Architecture Components:

User Interaction Layer:

User (Buyer/Underwriter): Initiates actions like buying policies or depositing/withdrawing collateral.

Frontend dApp: The web interface (React/Next.js) the user interacts with. It displays information, constructs transactions, and communicates with the wallet and RPC node.

Wallet Extension: Securely stores the user's private keys and prompts the user to sign transactions initiated by the dApp.

Solana RPC Node: The gateway for the frontend to send transactions to the Solana network and read account data from the blockchain.

Solana On-Chain Layer:

Policy Manager Program (Anchor/Rust): Handles the logic for creating and managing insurance policies. It defines the structure of Policy Accounts and initiates the premium transfer CPI.

Collateral Pool Program (Anchor/Rust): Manages the pool of USDC collateral provided by underwriters. It handles deposits and withdrawals. It contains the critical logic for checking policy expiry, reading the Pyth oracle price, evaluating the depeg trigger, calculating the binary payout, and initiating payout/withdrawal CPIs.

SPL Token Program (Solana Native): The standard Solana program used for all USDC token transfers (premiums, collateral deposits, payouts, withdrawals). The StableGuard programs interact with it via Cross-Program Invocations (CPIs).

Policy Accounts (PDAs): Program Derive  d Addresses controlled by the Policy Manager. Each PDA stores the state of a single insurance policy (insured amount, expiry, buyer, status, etc.). See Account Structures below.

Collateral Pool Token Account (PDA): An SPL Token Account controlled by the Collateral Pool Program. This PDA holds the aggregated USDC collateral deposited by all underwriters. Its structure is defined by the SPL Token Program, but its authority is the Collateral Pool Program PDA.

User's USDC Wallet Account: The standard token account owned by the user in their wallet.

External Dependencies Layer:

Pyth Network Oracle: An essential external data source providing real-time price feeds (USDT/USD, USDC/USD) directly on the Solana blockchain. The Collateral Pool Program reads this data to determine if a depeg trigger condition is met.

4. Account Structures (Class Diagram):

This diagram shows the data fields within the primary custom account type defined by the StableGuard protocol.

```mermaid
classDiagram
    class PolicyAccount {
        +buyer: Pubkey
        +insured_stablecoin_mint: Pubkey
        +insured_amount: u64
        +premium_paid: u64
        +start_timestamp: i64
        +expiry_timestamp: i64
        +status: PolicyStatus
        +bump: u8
        %% Potential additions:
        %% +trigger_threshold: u64
        %% +payout_type: string
    }

    class PolicyStatus {
        <<Enumeration>>
        Active
        ExpiredPaid
        ExpiredNotPaid
    }

    %% Note: Collateral Pool Token Account structure is defined by SPL Token Program
    %% Note: Underwriter position tracking (if needed beyond simple pool share) would require another struct

```

PolicyAccount (PDA): Stores the state for each individual insurance policy. Includes who bought it, what's insured, the amount, term, status, etc.

(Implicit) Collateral Pool Token Account (PDA): Holds the USDC collateral. Its structure (mint, owner, amount, etc.) is standard SPL Token Account format. The key aspect is that its owner (authority) is a PDA derived from the Collateral Pool Program.

5. Sequence Diagrams (MVP Flows):

These diagrams show the order of interactions between components for key flows.

5.1. Buy Policy Sequence:
<details>
  <summary>Click to view the Sequence Diagram</summary>

  ```mermaid
  sequenceDiagram
      actor User
      participant FE as Frontend dApp
      participant Wallet
      participant RPC as Solana RPC Node
      participant PGM as Policy Manager Program
      participant SPL as SPL Token Program
      participant CPA as Collateral Pool Account (PDA)
      participant PA as Policy Account (PDA)

      User->>+FE: Select Stablecoin and Amount to Insure; Initiate Buy
      FE->>Wallet: Request Signature for create_policy TX
      Wallet-->>-FE: Signed Transaction
      FE->>+RPC: Send Signed Transaction to Solana RPC Node
      RPC->>+PGM: Execute 'create_policy' instruction on Policy Manager Program
      PGM->>+SPL: CPI: Transfer Premium from User to Collateral Pool Account
      SPL-->>-PGM: Transfer Success/Fail
      PGM->>PGM: Create Policy Account PDA
      PGM-->>-RPC: Instruction Success/Fail
      RPC-->>-FE: Transaction Result
      FE-->>User: Display Confirmation/Error

  ```
</details>



5.2. Expiry Check & Payout Sequence:
```mermaid
sequenceDiagram
    actor Trigger as Keeper/User Action
    participant FE as Frontend dApp %% Optional initiator
    participant RPC as Solana RPC Node
    participant CPM as Collateral Pool Pgm
    participant PA as Policy Account (PDA)
    participant Oracle as Pyth Network Oracle
    participant SPL as SPL Token Pgm
    participant CPA as Collateral Pool Acct (PDA)
    participant BuyerWallet as Buyer Wallet Acct

    Trigger->>+FE: Initiate Expiry Check for Policy X
    FE->>+RPC: Send 'check_and_payout' Transaction
    RPC->>+CPM: Execute 'check_and_payout' instruction (Policy X Key)
    CPM->>PA: Read Policy Data (Expiry, Status, Amount, Buyer)
    PA-->>CPM: Policy Data
    CPM->>CPM: Check if Expired & Active
    alt Is Expired & Active
        CPM->>Oracle: Read Price Feed
        Oracle-->>CPM: Current Price
        CPM->>CPM: Check if Price < Threshold (Depeg?)
        alt Depeg Condition Met
            CPM->>CPM: Calculate Binary Payout Amount
            CPM->>CPA: Check Available Collateral
            CPA-->>CPM: Balance Info
            alt Sufficient Collateral
                CPM->>+SPL: CPI: Transfer Payout (CPA -> BuyerWallet)
                SPL-->>-CPM: Transfer Success/Fail
                CPM->>PA: Update Policy Status to ExpiredPaid
                PA-->>CPM: Status Updated
            else Insufficient Collateral
                CPM->>CPM: Handle Insufficient Collateral Logic
            end
        else No Depeg
            CPM->>PA: Update Policy Status to ExpiredNotPaid
            PA-->>CPM: Status Updated
        end
    else Policy Not Ready
        CPM->>CPM: Skip Processing
    end
    CPM-->>-RPC: Instruction Success/Fail
    RPC-->>-FE: Transaction Result
    FE-->>Trigger: Display Result
```
6. Detailed MVP Flowcharts:

These flowcharts illustrate the step-by-step process logic within the smart contracts for the core user actions in the MVP.

6.1. Buy Insurance Policy Flow:
```mermaid
graph TD
    A["User selects Stablecoin USDT/USDC<br/>& Amount to Insure via Frontend"] --> B{"Calculate Premium<br/>e.g., 0.5% of Amount"};
    B --> C["Display Policy Terms:<br/>7-day, <$0.985 Trigger,<br/>10% Binary Payout<br/>& Premium Cost"];
    C --> D{User Confirms Purchase<br/>& Signs TX via Wallet};
    D -- Yes --> E["Call 'create_policy' instruction<br/>on Policy Manager Program"];
    E --> F{Check User USDC Balance<br/>>= Premium?};
    F -- Yes --> G["Initiate CPI: Transfer Premium USDC<br/>from User Wallet to Collateral Pool Acct<br/>via SPL"];
    G --> H["Create Policy Account PDA storing details:<br/>Amount, Expiry, Buyer, Status=Active, etc."];
    H --> I["Emit 'PolicyCreated' Event"];
    I --> Z[End Flow: Success];
    F -- No --> X["Throw Error / Fail Transaction:<br/>Insufficient Funds"];
    D -- No --> Y[End Flow: User Cancelled];

    %% Style Adjustments
    style A fill:#FFF,stroke:#333;
    style B fill:#FFF,stroke:#333;
    style C fill:#FFF,stroke:#333;
    style D diamond,fill:#FFFFE0,stroke:#333;
    style E fill:#D5A6BD,stroke:#333;
    style F diamond,fill:#FFFFE0,stroke:#333;
    style G fill:#A6BDD5,stroke:#333;
    style H fill:#E0E0E0,stroke:#333;
    style I fill:#FFF,stroke:#333;
    style X fill:#FFCCCC,stroke:#333;
    style Y fill:#EEE,stroke:#333;
    style Z fill:#CCFFCC,stroke:#333;
```
6.2. Deposit Collateral Flow:
```mermaid
graph TD
    A["User enters USDC Amount<br/>to Deposit via Frontend"] --> B{User Confirms Deposit<br/>& Signs TX via Wallet};
    B -- Yes --> C["Call 'deposit_collateral' instruction<br/>on Collateral Pool Program"];
    C --> D{Check User USDC Balance<br/>>= Deposit Amount?};
    D -- Yes --> E["Initiate CPI: Transfer Collateral USDC<br/>from User Wallet to Collateral Pool Acct<br/>via SPL"];
    E --> F["Update Underwriter's Position Record<br/>e.g., increase share, mint LP tokens - Optional"];
    F --> G["Update Total Pool Collateral Value"];
    G --> H["Emit 'CollateralDeposited' Event"];
    H --> Z[End Flow: Success];
    D -- No --> X["Throw Error / Fail Transaction:<br/>Insufficient Funds"];
    B -- No --> Y[End Flow: User Cancelled];

    %% Style Adjustments
    style A fill:#FFF,stroke:#333;
    style B diamond,fill:#FFFFE0,stroke:#333;
    style C fill:#A6D5BD,stroke:#333;
    style D diamond,fill:#FFFFE0,stroke:#333;
    style E fill:#A6BDD5,stroke:#333;
    style F fill:#E0E0E0,stroke:#333;
    style G fill:#E0E0E0,stroke:#333;
    style H fill:#FFF,stroke:#333;
    style X fill:#FFCCCC,stroke:#333;
    style Y fill:#EEE,stroke:#333;
    style Z fill:#CCFFCC,stroke:#333;

```
6.3. Expiry Check & Payout Flow:
```mermaid
graph TD
    A["Start: Trigger Expiry Check for Policy X<br/>via Keeper/User Action"] --> B["Call 'check_and_payout'<br/>on Collateral Pool Program<br/>with Policy X Key"];
    B --> C["Read Policy X Account Data:<br/>Expiry Time, Insured Amount, Buyer, Status"];
    C --> D{Is Current Time >= Expiry Time<br/>AND Status == Active?};
    D -- Yes --> E["Read Pyth Network Price Feed<br/>for Insured Stablecoin"];
    E --> F{Oracle Price Available<br/>& Fresh?};
    F -- Yes --> G["Get Price_Expiry"];
    G --> H{Is Price_Expiry < $0.985?};
    H -- Yes --> I["Calculate Binary Payout<br/>e.g., 0.10 * Insured Amount"];
    I --> J{Is Pool Collateral<br/>>= Payout Amount?};
    J -- Yes --> K["Initiate CPI: Transfer Payout USDC<br/>from Collateral Pool Acct to Buyer Wallet<br/>via SPL"];
    K --> L["Update Policy X Status<br/>to 'Expired-Paid'"];
    L --> M["Emit 'PayoutExecuted' Event"];
    M --> Z[End Flow: Payout Success];
    H -- No --> N["Update Policy X Status<br/>to 'Expired-NotPaid'"];
    N --> O["Emit 'PolicyExpired' Event"];
    O --> Z1[End Flow: Expired Normally];
    J -- No --> P["Handle Insufficient Collateral<br/>e.g., Partial Payout?, Log Error, Pause?<br/>- Define Strategy!"];
    P --> X[End Flow: Insufficient Collateral];
    F -- No --> Q["Handle Oracle Error<br/>e.g., Log Error, Retry Later?, Pause?<br/>- Define Strategy!"];
    Q --> X1[End Flow: Oracle Error];
    D -- No --> Z2[End Flow: Policy Not Expired<br/>or Already Processed];

    %% Style Adjustments
    style A fill:#FFF,stroke:#333;
    style B fill:#A6D5BD,stroke:#333;
    style C fill:#E0E0E0,stroke:#333;
    style D diamond,fill:#FFFFE0,stroke:#333;
    style E fill:#f90,stroke:#333;
    style F diamond,fill:#FFFFE0,stroke:#333;
    style G fill:#FFF,stroke:#333;
    style H diamond,fill:#FFFFE0,stroke:#333;
    style I fill:#FFF,stroke:#333;
    style J diamond,fill:#FFFFE0,stroke:#333;
    style K fill:#A6BDD5,stroke:#333;
    style L fill:#E0E0E0,stroke:#333;
    style M fill:#FFF,stroke:#333;
    style N fill:#E0E0E0,stroke:#333;
    style O fill:#FFF,stroke:#333;
    style P fill:#FFCCCC,stroke:#333;
    style Q fill:#FFCCCC,stroke:#333;
    style X fill:#FFCCCC,stroke:#333;
    style X1 fill:#FFCCCC,stroke:#333;
    style Z fill:#CCFFCC,stroke:#333;
    style Z1 fill:#EEE,stroke:#333;
    style Z2 fill:#EEE,stroke:#333;
```
6.4. Withdraw Collateral Flow:
```mermaid
graph TD
    A["User enters USDC Amount<br/>to Withdraw via Frontend"] --> B{User Confirms Withdrawal<br/>& Signs TX via Wallet};
    B -- Yes --> C["Call 'withdraw_collateral' instruction<br/>on Collateral Pool Program"];
    C --> D["Read Underwriter's Position Record<br/>Deposited Amount, Accrued Premiums?"];
    D --> E{Check Withdrawal Conditions<br/>e.g., Lockup Period Elapsed?,<br/>Pool Utilization OK?};
    E -- Yes --> F{Is Requested Amount<br/><= Available Balance?};
    F -- Yes --> G["Calculate Net Withdrawal Amount<br/>Available Balance - Potential Fees"];
    G --> H["Initiate CPI: Transfer Withdrawal USDC<br/>from Collateral Pool Acct to User Wallet<br/>via SPL"];
    H --> I["Update Underwriter's Position Record<br/>Decrease Share/Balance"];
    I --> J["Update Total Pool Collateral Value"];
    J --> K["Emit 'CollateralWithdrawn' Event"];
    K --> Z[End Flow: Success];
    F -- No --> L["Throw Error / Fail Transaction:<br/>Insufficient Available Balance"];
    E -- No --> M["Throw Error / Fail Transaction:<br/>Withdrawal Condition Not Met<br/>e.g., Locked"];
    B -- No --> Y[End Flow: User Cancelled];

    %% Style Adjustments
    style A fill:#FFF,stroke:#333;
    style B diamond,fill:#FFFFE0,stroke:#333;
    style C fill:#A6D5BD,stroke:#333; %% Program Interaction
    style D fill:#E0E0E0,stroke:#333; %% Account Read
    style E diamond,fill:#FFFFE0,stroke:#333;
    style F diamond,fill:#FFFFE0,stroke:#333;
    style G fill:#FFF,stroke:#333;
    style H fill:#A6BDD5,stroke:#333; %% SPL Interaction
    style I fill:#E0E0E0,stroke:#333; %% Account Update
    style J fill:#E0E0E0,stroke:#333; %% Account Update
    style K fill:#FFF,stroke:#333;
    style L fill:#FFCCCC,stroke:#333; %% Error
    style M fill:#FFCCCC,stroke:#333; %% Error
    style Y fill:#EEE,stroke:#333; %% End State
    style Z fill:#CCFFCC,stroke:#333; %% Success State

```
