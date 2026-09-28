# BidFlow — Frontend

Sealed-bid auction dApp powered by **Fully Homomorphic Encryption (FHE)** on Arbitrum Sepolia. Bids are encrypted on-chain using the Fhenix CoFHE protocol — the contract compares them without ever decrypting, and only the winner is revealed.

## Tech Stack

| Layer      | Library                                    |
| ---------- | ------------------------------------------ |
| Framework  | React 19 + Vite + TypeScript               |
| Blockchain | wagmi v3, viem                             |
| Wallet     | RainbowKit v2                              |
| FHE        | @cofhe/react + @cofhe/sdk (Fhenix testnet) |
| Styling    | Tailwind CSS v4, Framer Motion             |
| Toasts     | Sonner                                     |
| Icons      | Lucide React                               |

## Provider Stack

```
BrowserRouter → WagmiProvider → QueryClientProvider → RainbowKitProvider → CofheProvider
```

The `CofheBridge` component inside `main.tsx` pipes `walletClient` and `publicClient` from wagmi into the CoFHE provider so encrypt/decrypt calls are signed by the connected wallet.

## Getting Started

### Prerequisites

- Node 18+
- A [WalletConnect Cloud project ID](https://cloud.walletconnect.com/) (free)

### Setup

```bash
cd frontend
cp .env.example .env
# Edit .env and paste your VITE_WALLETCONNECT_PROJECT_ID
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Available Commands

```bash
npm run dev       # Vite dev server
npm run build     # TypeScript check + production build
npm run preview   # Preview production build locally
npm run lint      # ESLint
```

## Project Structure

```
src/
├── main.tsx              # Entry point, provider wiring, CoFHE config
├── App.tsx               # Router, nav bar, footer, floating network bar
├── index.css             # Tailwind + custom CSS variables
├── pages/
│   ├── Home.tsx          # Landing page, how-it-works, stats
│   ├── CreateAuction.tsx # Seller creates auction with encrypted min bid
│   ├── AuctionDetail.tsx # Place bid, finalize, reveal winner
│   └── Demo.tsx          # Pre-seeded demo auctions
├── components/
│   ├── AuctionCard.tsx       # Auction list card with countdown
│   ├── CountdownTimer.tsx    # Live countdown component
│   ├── ErrorBoundary.tsx     # React error boundary
│   ├── TransactionToast.tsx  # TX status toast helpers
│   └── index.ts
├── config/
│   └── wagmi.ts          # RainbowKit + wagmi config (Arbitrum Sepolia)
├── constants/
│   ├── BidFlow.json    # Contract ABI (imported from Hardhat artifact)
│   └── contracts.ts      # Contract address + ABI export
└── types/
    └── index.ts          # Shared TypeScript types
```

## Contract

| Detail  | Value                                                                |
| ------- | -------------------------------------------------------------------- |
| Network | Arbitrum Sepolia (chainId 421614)                                    |
| Address | `0x96dA01145BE15b12e659630b4E4597Cb626Ff447`                         |
| ABI     | `src/constants/BidFlow.json` (symlinked from `contracts/artifacts/`) |

## FHE Encryption Flow

1. **Create Auction** — seller encrypts minimum bid via `cofheClient.encrypt.encryptUint64()`, submits `InEuint64` calldata struct
2. **Place Bid** — bidder encrypts bid amount same way, contract compares via FHE CMUX (`gt` + `select`)
3. **Finalize** — seller calls `FHE.allowPublic()` to make winner/bid decryptable
4. **Reveal** — anyone submits Threshold Network decrypt signatures; plaintext winner + bid become public

## Key Design

- Bid amounts are `uint64` in wei (max ~18.4 ETH). Convert with `BigInt(value * 1e18)`.
- Below-minimum bids are silently zeroed — contract never reveals rejected bids.
- One bid per address per auction. Ties go to the first bidder.
- The ABI is imported directly from `../../../contracts/artifacts/contracts/BidFlow.sol/BidFlow.json` — recompile contracts and the frontend picks up changes automatically.
