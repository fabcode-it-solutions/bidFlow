import type { Auction, AuctionStatus } from '../types';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Derive auction status from contract state.
 */
export function deriveStatus(biddingEnd: bigint, finalized: boolean, revealedWinner: string): AuctionStatus {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (finalized && revealedWinner !== ZERO_ADDRESS) return 'FINALIZED';
  if (finalized || biddingEnd <= now) return 'SETTLEMENT';
  return 'ACTIVE';
}

/**
 * Parse a raw contract tuple into a frontend-friendly Auction object.
 *
 * Off-chain fields (description, category, imageURI) default to empty strings.
 * These should be populated from IPFS or a metadata backend keyed by auction ID.
 *
 * @param raw - Contract return tuple (positional array)
 * @param id - Auction ID
 * @param sealedBidCount - From getBidderCount()
 * @param metadata - Optional off-chain metadata
 */
export function parseAuction(
  raw: unknown[],
  id: number,
  sealedBidCount: number = 0,
  metadata?: { description?: string; category?: string; imageURI?: string },
): Auction | null {
  // ABI has 10 fields: seller, title, biddingEnd, finalized, paymentClaimed,
  // minimumBid, highestBid, highestBidder, revealedBid, revealedWinner
  if (!Array.isArray(raw) || raw.length < 10) return null;

  const seller = raw[0];
  const title = raw[1];
  const biddingEnd = raw[2];
  const finalized = raw[3];
  const paymentClaimed = raw[4];
  const encryptedReservePrice = raw[5]; // minimumBid (encrypted)
  const revealedBid = raw[8];
  const revealedWinner = raw[9];

  if (
    typeof seller !== 'string' ||
    typeof title !== 'string' ||
    typeof biddingEnd !== 'bigint' ||
    typeof finalized !== 'boolean' ||
    typeof paymentClaimed !== 'boolean' ||
    typeof encryptedReservePrice !== 'string' ||
    typeof revealedBid !== 'bigint' ||
    typeof revealedWinner !== 'string'
  ) {
    return null;
  }

  return {
    id,
    seller,
    title,
    description: metadata?.description ?? '',
    category: metadata?.category ?? '',
    imageURI: metadata?.imageURI ?? '',
    encryptedReservePrice: encryptedReservePrice as `0x${string}`,
    duration: Number(biddingEnd) - Math.floor(Date.now() / 1000), // approximate
    revealWindow: 0, // not on-chain yet
    status: deriveStatus(biddingEnd, finalized, revealedWinner),
    sealedBidCount,
    biddingEnd,
    finalized,
    paymentClaimed,
    revealedWinner,
    revealedBid,
    createdAt: 0, // not on-chain yet
  };
}

/**
 * Parse a raw contract bid tuple into a Bid object.
 */
export function parseBid(raw: unknown): { exists: boolean; ethDeposited: bigint } {
  const bidData = raw as { exists: boolean; ethDeposited: bigint };
  return {
    exists: bidData.exists,
    ethDeposited: bidData.ethDeposited,
  };
}
