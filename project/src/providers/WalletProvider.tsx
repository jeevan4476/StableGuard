'use client'

import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base"
import { AnchorWallet,ConnectionProvider,useWallet,WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { ReactNode,useCallback,useMemo } from "react"
import "@solana/wallet-adapter-react-ui/styles.css"
import { AnchorProvider } from "@coral-xyz/anchor"
import { clusterApiUrl } from "@solana/web3.js"
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets"

interface WalletContextProviderProps {
  children: React.ReactNode;
}


export const WalletContextProvider: React.FC<WalletContextProviderProps>=({children})=>{
    const network = WalletAdapterNetwork.Devnet;
    const endpoint = useMemo(()=>clusterApiUrl(network),[network])
    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
    ], [])

    return(
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}