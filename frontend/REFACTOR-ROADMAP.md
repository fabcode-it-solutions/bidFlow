# BidFlow Refactor Plan

## Overview

BidFlow is a confidential sealed-bid auction platform built using Fhenix / CoFHE.

The original implementation treated auctions as text-based listings with confidential pricing.

After review, the correct product model is:

- The asset being auctioned is public.
- Bid amounts are private.
- Reserve prices are private.
- Winner determination remains confidential until settlement.

This document defines the required refactor.

---

# Core Product Philosophy

## Public Information

The following information should always be visible:

- Asset image
- Auction title
- Description
- Category
- Seller
- Auction duration
- Auction status
- Sealed bid count

## Confidential Information

The following information must remain encrypted:

- Reserve price
- Bid amount
- Highest bid comparison
- Winner selection before settlement

---

# Phase 1 - Data Model Refactor

## Existing Problem

Current auction model focuses on:

- Title
- Description
- Starting Price

This creates a text-based auction experience.

Users do not know what asset they are bidding on.

## New Auction Model

```ts
interface Auction {
  id: string;
  seller: string;

  title: string;
  description: string;

  category: string;

  imageURI: string;

  encryptedReservePrice: string;

  duration: number;

  revealWindow: number;

  status: "ACTIVE" | "SETTLEMENT" | "FINALIZED";

  sealedBidCount: number;

  createdAt: number;
}
```

## Bid Model

```ts
interface Bid {
  auctionId: string;

  bidder: string;

  encryptedBidAmount: string;

  submittedAt: number;
}
```

---

# Phase 2 - Create Auction Refactor

## Goal

Users create an asset auction.

Not a text listing.

## New Layout

### Asset Details

Fields:

- Asset Image Upload
- Auction Title
- Description
- Category

### Auction Rules

Fields:

- Reserve Price
- Duration
- Reveal Window

### Preview

Display:

- Asset image
- Title
- Category
- Duration
- Privacy badges

Example badges:

- Public Asset
- Encrypted Reserve
- Sealed Bids

---

# Phase 3 - Auction Card Refactor

## Existing Problem

Auction cards look like text entries.

## New Card Design

Display:

- Asset image
- Title
- Category
- Status
- Sealed bid count
- Time remaining

Actions:

- View Auction
- Place Bid
- Settle Auction

Depending on phase.

## Never Display

Do NOT display:

- Current highest bid
- Current bid value
- Bid history
- Leaderboard

---

# Phase 4 - Auction Detail Page

## Layout

### Left Section

Display:

- Large asset image
- Title
- Description
- Category
- Seller

### Right Section

Display:

- Status
- Time remaining
- Sealed bid count
- User action

### Privacy Notice

Example:

Your bid amount remains encrypted and hidden from other participants during the auction.

---

# Phase 5 - Place Bid Flow

## User Journey

1. Open auction
2. Enter bid amount
3. Encrypt bid
4. Submit transaction

## Bid Modal

Fields:

Bid Amount

Privacy Notice

Submit Button

Button text:

Encrypt & Submit Bid

## Frontend Flow

```txt
User Input
↓
Encrypt Bid
↓
Submit Transaction
↓
Store Encrypted Bid
↓
Increase Bid Count
```

---

# Phase 6 - Settlement Flow

## Goal

Determine winner without exposing bids publicly.

## Settlement Lifecycle

### Phase 1

Bidding Active

Users submit encrypted bids.

### Phase 2

Settlement Requested

Winner computation initiated.

### Phase 3

Settlement Finalized

Winner becomes public.

## Display States

ACTIVE

SETTLEMENT

FINALIZED

---

# Phase 7 - Dashboard Refactor

## Goal

Focus on user actions.

Avoid fake analytics.

## Layout

### Hero

Title:

Confidential Asset Auctions

Subtitle:

Create public asset listings with private bid amounts.

### Statistics

- Active Auctions
- My Active Bids
- Pending Settlement

### Main Content

Auction Grid

Auction List

### Empty State

No auctions found.

Create your first confidential auction.

---

# Phase 8 - Smart Contract Refactor

## Public Fields

```solidity
title
description
category
imageURI
seller
endTime
```

## Encrypted Fields

```solidity
reservePrice
bidAmount
winnerCalculation
```

## Required Functions

```solidity
createAuction()

placeBid()

requestSettlement()

finalizeSettlement()
```

---

# Phase 9 - Asset Storage Strategy

## MVP

Store image publicly.

Supported:

- IPFS
- Hosted URL
- Storage Provider

## Not Required

Do NOT encrypt images for MVP.

Image confidentiality is not part of the auction privacy model.

Only bids require privacy.

---

# Phase 10 - Terminology Refactor

## Replace

Starting Price

With

Reserve Price

---

## Preferred Terms

- Asset
- Reserve Price
- Sealed Bid
- Encrypted Bid
- Settlement
- Verified Result

---

## Avoid

- Highest Bid
- Live Bid
- Current Price
- Leaderboard
- Bid History

These concepts belong to open auctions, not sealed-bid auctions.

---

# Technical Priorities

Priority 1

- Asset Image Upload
- Reserve Price Refactor
- Updated Data Models

Priority 2

- Auction Cards
- Auction Detail Page

Priority 3

- Settlement UX Improvements

Priority 4

- Advanced Features
- Encrypted Asset Delivery
- Winner-Only Content Access

---

# Definition of Success

A user can:

1. Create an auction for a visible asset.
2. Set an encrypted reserve price.
3. Receive encrypted bids.
4. Finalize settlement.
5. Reveal winner without exposing bid amounts during the auction.

The platform should feel like a professional confidential auction system rather than a text-based listing application.
