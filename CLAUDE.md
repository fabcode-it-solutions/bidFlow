# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BidFlow is a sealed-bid auction dApp where bids remain encrypted on-chain using Fhenix Fully Homomorphic Encryption (FHE). The contract compares encrypted bids via FHE CMUX operations without ever decrypting them — only the winner is revealed. Deployed on Arbitrum Sepolia.

## Repository Structure

```
contracts/   — Hardhat + Solidity (CoFHE plugin, single contract)
frontend/    — React 19 + Vite + TypeScript (wagmi v3, RainbowKit v2, @cofhe/react)
```

## Commands

```bash
# Contracts
cd contracts
npm run compile          # hardhat compile
npm test                 # hardhat test (uses CoFHE mock coprocessor)
npm run deploy:arb-sepolia  # Deploy to Arbitrum Sepolia

# Frontend
cd frontend
npm run dev              # Vite dev server (localhost:5173)
npm run build            # tsc + vite build
npm run lint             # eslint
```

Set `PRIVATE_KEY` in `contracts/.env` (or `../.env`) for deployment. Frontend needs `VITE_WALLETCONNECT_PROJECT_ID`.

## Smart Contract (`contracts/contracts/BidFlow.sol`)

Single contract, ~270 lines. Uses `@fhenixprotocol/cofhe-contracts` (`FHE.sol`).

**Encrypted types in play:**

- `euint64` — encrypted uint64 (bid amounts, minimum bid)
- `eaddress` — encrypted address (highest bidder)
- `ebool` — encrypted boolean (comparison results)
- `InEuint64` — calldata struct: `{ ctHash, securityZone, utype, signature }`

**Auction lifecycle:**

1. `createAuction(title, duration, minBidEncrypted)` — seller creates auction with encrypted minimum bid. Calls `FHE.allowThis()` to let the contract read the encrypted state later.
2. `placeBid(auctionId, encryptedBid)` — bidder submits encrypted bid. Enforces minimum bid via `FHE.gte` + `FHE.select` (below-minimum bids get zeroed out). Updates highest bid/bidder using CMUX (`FHE.gt` + `FHE.select`). One bid per address.
3. `finalize(auctionId)` — seller-only. Calls `FHE.allowPublic()` on highestBid/highestBidder to make them publicly decryptable.
4. `revealWinner(auctionId, bidCtHash, bidDecrypted, bidSignature, winnerCtHash, winnerDecrypted, winnerSignature)` — anyone can call after finalize. Submits Threshold Network decrypt signatures; contract verifies via `FHE.publishDecryptResult()`.

**Key design decisions:**

- The `_bidders[]` array tracks bidders per auction for iteration.
- `FHE.allowThis()` must be called after every mutation to encrypted state (the contract's ACL permission doesn't persist across writes).
- `FHE.select(cond, ifTrue, ifFalse)` is the CMUX primitive — it chooses between two encrypted values based on an encrypted boolean. Used for both minimum-bid enforcement and winner tracking.

## Contract ABIs

The frontend imports the ABI directly from the Hardhat artifact:

```typescript
import BidFlowArtifact from "../../../contracts/artifacts/contracts/BidFlow.sol/BidFlow.json";
export const BidFlow_ABI = BidFlowArtifact.abi;
```

After recompiling contracts, the frontend picks up the updated ABI automatically.

## Frontend Architecture

**Provider stack** (nested, in order): `BrowserRouter` → `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider` → `CofheProvider`

**CoFHE config** (`main.tsx`): Points to Fhenix testnet endpoints on Arbitrum Sepolia (chainId 421614).

**Contract interaction pattern** (used in all pages):

```typescript
// Reads — useReadContract from wagmi
const { data } = useReadContract({
  address: BidFlow_ADDRESS, abi: BidFlow_ABI,
  functionName: 'auctions', args: [auctionId],
});

// Writes — useWriteContract + useWaitForTransactionReceipt
const { data: hash, writeContract } = useWriteContract();
const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

// Client-side FHE encryption before writes
const cofheClient = useCofheClient();
const encrypted = await cofheClient.encrypt.encryptUint64(BigInt(value * 1e18));
const inEuint64 = {
  ctHash: BigInt(encrypted.ctHash),
  securityZone: encrypted.securityZone,
  utype: encrypted.utype,
  signature: encrypted.signature as `0x${string}`,
};
writeContract({ ... , functionName: 'placeBid', args: [auctionId, inEuint64] });
```

**Decryption flow** (AuctionDetail):

```typescript
const bidResult = await cofheClient.decrypt.decryptUint64(ctHash); // returns string | null
const addrResult = await cofheClient.decrypt.decryptAddress(ctHash); // returns string | null
```

Works after `FHE.allowPublic()` has been called (post-finalize). Before that, decryption returns null.

**Demo page** (`Demo.tsx`): Uses a mock `encryptInputsAsync` because the real `useCofheEncrypt` hook had a steps-format compatibility issue. Creates 3 pre-seeded auctions.

## Testing (`contracts/test/BidFlow.test.ts`)

Uses Hardhat with CoFHE mock coprocessor. Key patterns:

```typescript
// Deploy mock FHE environment + contract
await hre.run(TASK_COFHE_MOCKS_DEPLOY);
const BidFlow = await BidFlow.deploy();

// Per-signer FHE clients
const aliceClient = await hre.cofhe.createClientWithBatteries(alice);

// Encrypt test values
const [encrypted] = await aliceClient
  .encryptInputs([Encryptable.uint64(500n)])
  .execute();

// Read encrypted state via mock coprocessor (bypasses ACL, test-only)
const plaintext = await hre.cofhe.mocks.getPlaintext(ctHash);

// Time travel
await hre.network.provider.send("evm_increaseTime", [61]);
await hre.network.provider.send("evm_mine");

// Decrypt-for-tx flow in tests
const result = await client.decryptForTx(ctHash).withoutPermit().execute();
// result: { ctHash, decryptedValue, signature }
```

## Key Constraints

- Bid amounts are `uint64` in wei (max ~18.4 ETH). Use `BigInt(value * 1e18)` for conversion.
- Auction durations are in seconds.
- "Finalized" means bidding is closed AND `allowPublic` has been called. "Revealed" means plaintext winner/bid are on-chain.
- The contract uses `auctionCounter` (auto-increment); first auction ID is 0.
- Ties go to the first bidder (FHE.gt is strict greater-than, so equal bids don't unseat the current highest).
- Below-minimum bids are silently zeroed — the contract never reveals whether a bid was rejected.
