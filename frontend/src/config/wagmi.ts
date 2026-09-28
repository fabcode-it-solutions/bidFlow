import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia } from "wagmi/chains";
import { http, fallback } from "wagmi";
import {
  metaMaskWallet,
  phantomWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
  braveWallet,
} from "@rainbow-me/rainbowkit/wallets";

const ARBITRUM_SEPOLIA_RPCS = [
  "https://sepolia-rollup.arbitrum.io/rpc",
  "https://arbitrum-sepolia-rpc.publicnode.com",
  "https://arbitrum-sepolia.blockpi.network/v1/rpc/public",
];

export const config = getDefaultConfig({
  appName: "BidFlow",
  projectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
    "54ce33a78839144d41972bbdb6f18d76",
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: fallback(
      ARBITRUM_SEPOLIA_RPCS.map((url) => http(url)),
    ),
  },
  wallets: [
    {
      groupName: "Installed",
      wallets: [metaMaskWallet, phantomWallet, braveWallet],
    },
    {
      groupName: "Popular",
      wallets: [rainbowWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
});
