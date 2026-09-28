# BidFlow

BidFlow is a sealed-bid auction protocol where bids stay encrypted on-chain using Fully Homomorphic Encryption (FHE). The contract compares encrypted bids via FHE CMUX operations without ever decrypting them — only the winner is revealed after settlement.

**Core Value Proposition:**

> Public Asset. Private Bids. Verifiable Settlement.

---

## The Problem

On-chain auctions are fundamentally broken. Every bid is visible on the blockchain, enabling:

- **MEV extraction**: Bots monitor the mempool and front-run legitimate bids
- **Bid sniping**: Last-minute bids steal auctions from honest participants
- **Price manipulation**: Competitors see your strategy and adjust accordingly

Traditional solutions require trusted third parties or off-chain computation, which reintroduces centralization risks.

## The Solution

BidFlow uses Fhenix's Fully Homomorphic Encryption to keep bids encrypted on-chain while still allowing the contract to compute the winner. The contract can compare encrypted values without ever decrypting them — no trusted party needed.

### How FHE Works

FHE allows computations on encrypted data without decryption. BidFlow uses:

- `euint64` — encrypted uint64 for bid amounts
- `eaddress` — encrypted address for winner identity
- `FHE.select()` — CMUX operation to compare encrypted bids
- `FHE.allowPublic()` — make winner decryptable after finalization

---

## Tech Stack

| Layer           | Technology                                   |
| --------------- | -------------------------------------------- |
| Smart Contracts | Solidity 0.8.28, Fhenix CoFHE                |
| Dev Tooling     | Hardhat, @cofhe/hardhat-plugin               |
| Frontend        | React 19, Vite, TypeScript                   |
| Wallet          | wagmi v3, RainbowKit v2                      |
| FHE Client      | @cofhe/sdk + @cofhe/react                    |
| Styling         | Custom CSS (Geist fonts, institutional dark) |
| Chain           | Arbitrum Sepolia (chainId: 421614)           |

---

## Repository Structure

```
contracts/
├── contracts/BidFlow.sol    — Main auction contract (~430 lines)
├── test/BidFlow.test.ts     — 47 tests (Hardhat + CoFHE mock)
└── scripts/deploy.ts          — Deployment script

frontend/
├── src/pages/                 — 11 pages
│   ├── Home.tsx               — Dashboard with privacy model
│   ├── CreateAuction.tsx      — Auction creation form
│   ├── AuctionDetail.tsx      — Bid, finalize, reveal, claim
│   ├── ActiveAuctions.tsx     — Browse active auctions
│   ├── MyBids.tsx             — Track user's bids
│   ├── RevealCenter.tsx       — Auctions awaiting reveal
│   ├── Settlement.tsx         — Claim payments/refunds
│   ├── Verification.tsx       — On-chain proof feed
│   ├── Docs.tsx               — Protocol documentation
│   ├── Demo.tsx               — Demo templates
│   └── NotFound.tsx           — 404 page
├── src/components/            — Reusable components
│   ├── DashboardLayout.tsx    — Main layout with sidebar
│   ├── Sidebar.tsx            — Navigation sidebar
│   ├── Topbar.tsx             — Header with search
│   ├── EmptyState.tsx         — Empty state component
│   └── CountdownTimer.tsx     — Auction timer
├── src/styles/                — CSS modules
│   ├── variables.css          — Design tokens
│   ├── components/            — Component styles
│   └── pages/                 — Page styles
└── src/constants/contracts.ts — Contract address + ABI
```

---

## Smart Contract

### Auction Lifecycle

```
createAuction() → placeBid() → finalize() → revealWinner() → claimPayment()/claimRefund()
```

### Key Functions

| Function                                              | Description                                         |
| ----------------------------------------------------- | --------------------------------------------------- |
| `createAuction(title, duration, minimumBidEncrypted)` | Create auction with an encrypted-only reserve price |
| `placeBid(auctionId, bidAmountEncrypted)`             | Submit encrypted bid + ETH deposit                  |
| `finalize(auctionId)`                                 | Close bidding, allow public decryption              |
| `revealWinner(auctionId, ...)`                        | Verify Threshold Network signatures, publish winner |
| `claimPayment(auctionId)`                             | Seller claims winner's ETH deposit                  |
| `claimRefund(auctionId)`                              | Losers claim ETH refund                             |

### Security Features

- ReentrancyGuard on payment/refund functions
- MAX_BIDDERS cap (500)
- Bidder index bounds checking
- Custom errors for gas efficiency
- FHE.allowThis() after every encrypted state mutation

### Test Coverage

47 tests covering:

- Create auction (valid, invalid, events)
- Place bid (valid, seller rejection, duplicate, late, insufficient)
- CMUX winner selection (ascending, descending, ties, minimum enforcement)
- Finalize (valid, non-seller, early, empty, double)
- Reveal (valid, without finalize, double)
- Claim payment (valid, non-seller, double, before reveal)
- Claim refund (valid, winner rejection, double, before reveal, non-bidder)

---

## Frontend

### Pages

| Page           | Description                                         |
| -------------- | --------------------------------------------------- |
| Home           | Dashboard with privacy model, stats, auctions table |
| CreateAuction  | Form to create encrypted auction                    |
| AuctionDetail  | Bid placement, finalize, reveal, claim flows        |
| ActiveAuctions | Browse and search active auctions                   |
| MyBids         | Track user's sealed bids                            |
| RevealCenter   | Auctions awaiting winner reveal                     |
| Settlement     | Claim payments and refunds                          |
| Verification   | On-chain proof feed                                 |
| Docs           | Protocol documentation                              |
| Demo           | Demo auction templates                              |

### Design System

- **Font:** Geist Sans + Geist Mono
- **Colors:** Institutional dark (#050608 bg, #2DD4BF teal accent)
- **Buttons:** Primary (#E5E7EB), Secondary (transparent), Ghost
- **Cards:** 16px radius, gradient backgrounds
- **Badges:** Pill style, color-coded (active, warning, finalized)

### Key Features

- FHE encryption in-browser via CoFHE SDK
- Wallet connection via RainbowKit
- Search auctions by title
- Bid confirmation dialog with balance check
- Breadcrumb navigation
- Loading skeletons (no fake zeros)
- Empty states with clear guidance
- Responsive design (390px, 768px, 1440px)

---

## Local Setup

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone
git clone https://github.com/fabcode-it-solutions/bidFlow
cd BidFlow

# Contracts
cd contracts
npm install

# Frontend
cd ../frontend
npm install
```

### Environment Variables

**Contracts** — `.env` in `/contracts`:

```bash
PRIVATE_KEY=your_private_key_here
```

**Frontend** — `.env` in `/frontend`:

```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### Commands

```bash
# Compile contracts
cd contracts
npm run compile

# Run tests
npm test

# Deploy to Arbitrum Sepolia
npm run deploy:arb-sepolia

# Run frontend
cd frontend
npm run dev
```

---

## Known Limitations

1. **Bid/Deposit Mismatch:** Contract allows encrypted bid amount to differ from ETH deposit
2. **No Auction Cancellation:** Once created, auction must run its course
3. **No Bid Withdrawal:** ETH locked until settlement
4. **Title Length Limit:** Unbounded string calldata (gas bomb risk)
5. **Image Storage:** Uses data URLs, not IPFS
6. **Off-Chain Metadata:** Description, category not stored on-chain

These are documented and postponed for post-buildathon improvement.
