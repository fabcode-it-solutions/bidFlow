# BidFlow_EXECUTION_ROADMAP.md

## Current Status

The core product model has been corrected.

Old assumption:

- Auctions are text listings.
- Users create title + description + starting price.

New validated model:

- Auctions represent real assets.
- Assets are public.
- Bid amounts are private.
- Reserve prices are private.
- Winner selection is confidential until settlement.

This is now the foundation of BidFlow.

---

# Current Priority

DO NOT work on:

- Design system
- Typography
- Color palette
- Branding polish
- Button styles
- Sidebar redesign
- Footer redesign

Yet.

The product architecture must be completed first.

---

# Development Order

## Phase 1

Data Model Refactor

Status:
DONE

Goals:

- Fix terminology
- Introduce imageURI
- Introduce category
- Replace startingPrice with reservePrice
- Add sealedBidCount
- Align frontend model with real auction flow

Deliverables:

- Updated types
- Updated interfaces
- Updated data mapping
- Updated terminology

---

## Phase 2

Create Auction Refactor

Status:
DONE

Goals:

Transform Create Auction into an asset listing flow.

Sections:

### Asset Details

- Asset Image Upload
- Auction Title
- Description
- Category

### Auction Rules

- Reserve Price
- Duration
- Settlement Window

### Preview

- Asset Image
- Title
- Category
- Duration
- Privacy Summary

Success Criteria:

Users clearly understand they are creating an auction for an asset.

---

## Phase 3

Auction Card Refactor

Status:
IN PROGRESS

Goals:

Make auction cards asset-centric.

Display:

- Image
- Title
- Category
- Phase
- Time Remaining
- Sealed Bid Count

Never Display:

- Current Highest Bid
- Bid Amounts
- Bid Leaderboard

Success Criteria:

Users understand what asset is being auctioned before opening details.

---

## Phase 4

Auction Detail Refactor

Status:
IN PROGRESS

Goals:

Build the core auction experience.

Layout:

Left:

- Asset Image
- Description
- Seller
- Category

Right:

- Auction Status
- Time Remaining
- Sealed Bid Count
- Action Button

Actions:

ACTIVE:
Place Bid

SETTLEMENT:
Finalize

FINALIZED:
View Result

Success Criteria:

Users can participate without confusion.

---

## Phase 5

Bid Submission Experience

Status:
PENDING

Goals:

Build confidence around private bidding.

Flow:

Enter Bid
↓
Encrypt Bid
↓
Submit Transaction
↓
Store Encrypted Value

Success Criteria:

Users understand their bid remains confidential.

---

## Phase 6

Settlement UX

Status:
PENDING

Goals:

Visualize auction completion clearly.

States:

ACTIVE

SETTLEMENT

FINALIZED

Success Criteria:

Users understand when the winner is determined.

---

## Phase 7

Dashboard Refactor

Status:
PENDING

Important:

Dashboard is not the product.

The auction flow is the product.

Dashboard should remain minimal.

Structure:

Hero

Stats

Auction List

Empty State

Success Criteria:

Dashboard drives actions instead of displaying noise.

---

## Phase 8

Smart Contract Refactor

Status:
POSTPONED

Reason:

UI and product model must stabilize first.

Current Strategy:

Frontend First

Contract Later

Tasks:

- imageURI support
- category support
- reserve price cleanup
- settlement improvements

Do not modify contracts until frontend architecture is validated.

---

# Design Freeze

Until Phases 1-4 are completed:

DO NOT redesign:

- fonts
- colors
- sidebar
- navbar
- buttons
- footer

Reason:

Changing visual systems before product architecture stabilizes causes rework.

---

# Design System Phase

Only start after:

Phase 1 Complete

Phase 2 Complete

Phase 3 Complete

Phase 4 Complete

Then perform:

## Typography Research

Reference:

- Linear
- Stripe
- Vercel
- Railway
- Supabase

## Component System

- Buttons
- Cards
- Inputs
- Empty States

## Layout System

- Sidebar
- Header
- Footer

## Color System

- Background
- Surface
- Accent
- Status Colors

---

# Definition of Success

BidFlow should communicate one idea instantly:

Public Asset.
Private Bids.

Users should understand:

- What is being auctioned.
- Why bids are hidden.
- How settlement works.

Without needing documentation.

If users need a tutorial to understand the product, the product is not finished.
