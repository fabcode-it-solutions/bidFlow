/**
 * Auction status derived from contract state.
 * ACTIVE: Bidding is open
 * SETTLEMENT: Bidding closed, winner computation in progress
 * FINALIZED: Winner revealed, settlement complete
 */
export type AuctionStatus = 'ACTIVE' | 'SETTLEMENT' | 'FINALIZED';

/**
 * Frontend-friendly auction model.
 * Maps from contract tuple + off-chain metadata.
 */
export interface Auction {
  id: number;
  seller: string;

  title: string;
  description: string;
  category: string;
  imageURI: string;

  /** Encrypted on-chain — never displayed as plaintext */
  encryptedReservePrice: `0x${string}`;

  /** Seconds */
  duration: number;

  /** Seconds after bidding ends for reveal */
  revealWindow: number;

  /** Derived from contract state */
  status: AuctionStatus;

  /** From getBidderCount() */
  sealedBidCount: number;

  /** Bidding end timestamp (seconds) */
  biddingEnd: bigint;

  /** Whether settlement has been finalized */
  finalized: boolean;

  /** Whether seller has claimed payment */
  paymentClaimed: boolean;

  /** Revealed after settlement — 0x0...0 if not yet revealed */
  revealedWinner: string;

  /** Revealed winning bid amount (0 if not yet revealed) */
  revealedBid: bigint;

  /** Timestamp when auction was created */
  createdAt: number;
}

/**
 * Bid model — represents a sealed bid.
 * Bid amount is encrypted and never displayed.
 */
export interface Bid {
  auctionId: number;
  bidder: string;
  encryptedBidAmount: `0x${string}`;
  submittedAt: number;
  exists: boolean;
}

/**
 * Raw contract return tuple.
 * Used internally by parseAuction — don't use directly in components.
 */
export interface ContractAuctionTuple {
  0: string;   // seller
  1: string;   // title
  2: bigint;   // biddingEnd
  3: boolean;  // finalized
  4: boolean;  // paymentClaimed
  5: `0x${string}`; // minimumBid (encrypted)
  6: `0x${string}`; // highestBid (encrypted)
  7: `0x${string}`; // highestBidder (encrypted)
  8: bigint;   // revealedBid
  9: string;   // revealedWinner
}
