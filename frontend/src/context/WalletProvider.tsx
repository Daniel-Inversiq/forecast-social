"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CHAIN_KEY, SCRY_SUPPORTED_CHAINS } from "@/lib/wallet/chains";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

type WalletContextValue = {
  enabled: boolean;
};

const WalletContext = createContext<WalletContextValue>({ enabled: false });

export function useWalletContext() {
  return useContext(WalletContext);
}

function WalletContextBridge({ children }: { children: ReactNode }) {
  return (
    <WalletContext.Provider value={{ enabled: Boolean(PRIVY_APP_ID) }}>
      {children}
    </WalletContext.Provider>
  );
}

export function ScryWalletProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <WalletContextBridge>{children}</WalletContextBridge>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#7c3aed",
          logo: undefined,
          showWalletLoginFirst: true,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "off",
          },
        },
        supportedChains: [...SCRY_SUPPORTED_CHAINS],
        defaultChain: SCRY_SUPPORTED_CHAINS.find((c) => c.id === 8453) ?? SCRY_SUPPORTED_CHAINS[0],
      }}
    >
      <WalletContextBridge>{children}</WalletContextBridge>
    </PrivyProvider>
  );
}

export function isWalletStackEnabled(): boolean {
  return Boolean(PRIVY_APP_ID);
}

export { DEFAULT_CHAIN_KEY };
