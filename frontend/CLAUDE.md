# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BidFlow is a sealed-bid auction dApp where bids remain encrypted on-chain using Fhenix Fully Homomorphic Encryption (FHE). This is the React frontend — the Solidity contracts live in `../contracts/`. Deployed on Arbitrum Sepolia.

## Commands

```bash
npm run dev       # Vite dev server (localhost:5173)
npm run build     # tsc + vite build
npm run lint      # ESLint
npm run preview   # Preview production build
```

No test runner is configured — there are no tests in this project.

## Architecture

### Provider Stack (main.tsx, outermost → innermost)

```
StrictMode → BrowserRouter → WagmiProvider → QueryClientProvider → RainbowKitProvider → CofheBridge
```

`CofheBridge` (`src/components/CofheBridge.tsx`) wraps `CofheProvider` + Sonner toaster. It passes the wagmi `walletClient`/`publicClient` into CoFHE so FHE operations are signed by the connected wallet. Config targets Arbitrum Sepolia (chainId 421614) with Fhenix testnet endpoints.

### Contract Interaction

The ABI comes from a Hardhat artifact JSON (`src/constants/BidFlow.json`). All contract access goes through `src/constants/contracts.ts` which exports `BidFlow_ADDRESS` and `BidFlow_ABI`.

**Reads** — `useReadContract` from wagmi. Contract returns are positional arrays (e.g., `auction[0]` is seller, `auction[1]` is title). The `Auction` interface in `src/types/index.ts` maps these.

**Writes** — `useWriteContract` + `useWaitForTransactionReceipt`.

**FHE encryption before writes:**

```typescript
const client = useCofheClient();
const [encrypted] = await client.encrypt
  .encryptInputs([Encryptable.uint64(BigInt(value * 1e18))])
  .execute();
// Pass encrypted result directly to writeContract args
```

**FHE decryption (post-finalize only):**

```typescript
const result = await client.decrypt.decryptUint64(ctHash); // string | null
const addrResult = await client.decrypt.decryptAddress(ctHash);
```

Encryption has a multi-step pipeline (initTfhe → fetchKeys → pack → prove → verify). `CreateAuction.tsx` tracks these steps with a progress bar. `AuctionDetail.tsx` uses `decryptForView` to show the connected user their own encrypted bid/bidder status.

### Routes (App.tsx)

| Path           | Component      | Notes                                                |
| -------------- | -------------- | ---------------------------------------------------- |
| `/`            | Home           | Dashboard with live auctions, activity feed          |
| `/auctions`    | ActiveAuctions | Searchable auction list                              |
| `/create`      | CreateAuction  | Accepts template state via `location.state`          |
| `/auction/:id` | AuctionDetail  | Full lifecycle: bid, finalize, reveal, claim, refund |
| `/demo`        | Demo           | Pre-filled templates that navigate to `/create`      |
| `*`            | NotFound       | 404                                                  |

Header is hidden on `/auction/:id` routes. Page transitions use framer-motion `AnimatePresence`.

### Styling

All styling is in `src/index.css` (~4,400 lines) using Tailwind CSS 4 + custom CSS (glassmorphism effects, dark/light themes). No CSS modules. Mobile viewports (<768px) get a `no-glass` class that disables `backdrop-filter` for performance.

### Key Libraries

| Library                   | Purpose                                    |
| ------------------------- | ------------------------------------------ |
| wagmi + viem              | Blockchain reads/writes, wallet connection |
| @rainbow-me/rainbowkit    | Wallet connect UI (6 wallets configured)   |
| @cofhe/react + @cofhe/sdk | Fhenix FHE encrypt/decrypt client          |
| @tanstack/react-query     | Data caching (required by wagmi)           |
| framer-motion             | Page transitions, component animations     |
| sonner                    | Toast notifications                        |
| canvas-confetti           | Winner celebration effect (AuctionDetail)  |
| lucide-react              | Icons                                      |

## Environment

`VITE_WALLETCONNECT_PROJECT_ID` — required for WalletConnect. Set in `.env` (see `.env.example`).

## Gotchas

- **Bid amounts are uint64 in wei** — max ~18.4 ETH. Use `BigInt(value * 1e18)` for conversion.
- **Contract reads return positional arrays** — `auction[0]` is seller, `auction[1]` is title, etc. The `Auction` type in `src/types/index.ts` defines the mapping.
- **No path aliases** — all imports use relative paths (no `@/` prefix).
- **Utility functions are co-located** with the pages that use them (e.g., `formatEth`, `shortAddress` in AuctionDetail.tsx). No shared utils directory.
- **The CSS file is large** — prefer adding Tailwind utility classes in JSX over editing `index.css` when possible.
- **Contract address** — `0x96dA01145BE15b12e659630b4E4597Cb626Ff447` on Arbitrum Sepolia (defined in `src/constants/contracts.ts`).
