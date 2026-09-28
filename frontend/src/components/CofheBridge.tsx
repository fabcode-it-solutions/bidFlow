import { CofheProvider, createCofheConfig } from "@cofhe/react";
import { Toaster } from "sonner";
import { usePublicClient, useWalletClient } from "wagmi";

const cofheConfig = createCofheConfig({
  supportedChains: [
    {
      id: 421614,
      name: "Arbitrum Sepolia",
      network: "arb-sepolia",
      coFheUrl: "https://testnet-cofhe.fhenix.zone",
      verifierUrl: "https://testnet-cofhe-vrf.fhenix.zone",
      thresholdNetworkUrl: "https://testnet-cofhe-tn.fhenix.zone",
      environment: "TESTNET",
    },
  ],
});

export function CofheBridge({ children }: { children: React.ReactNode }) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  return (
    <CofheProvider config={cofheConfig} walletClient={walletClient} publicClient={publicClient}>
      {children}
      <Toaster position="bottom-right" richColors theme="dark" />
    </CofheProvider>
  );
}
