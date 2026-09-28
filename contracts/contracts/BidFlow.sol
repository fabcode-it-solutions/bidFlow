// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BidFlow — Sealed-Bid Auction with FHE + ETH Escrow
/// @notice Bids remain encrypted on-chain until finalization. Winner is
///         determined entirely in encrypted space using FHE.select() (CMUX).
///         ETH is escrowed during bidding and released after reveal.
/// @dev Bid amounts are encrypted scores used for ranking. The winner's
///      ETH deposit (not the encrypted bid value) is transferred to the seller.
///      euint64 supports values up to ~18.4 ETH. For larger auctions,
///      consider using a different unit or upgrading to euint128.
contract BidFlow is ReentrancyGuard {
    // ──────────────────────────────── Types ────────────────────────────────

    struct Auction {
        address seller;
        string title;
        uint256 biddingEnd;
        bool finalized;
        bool paymentClaimed;
        // Encrypted running state — only the contract (via ACL) can read these
        euint64 minimumBid;
        euint64 highestBid;
        eaddress highestBidder;
        // Decrypted result — zero until finalize + reveal
        uint64 revealedBid;
        address revealedWinner;
    }

    struct Bid {
        euint64 amount;
        uint256 ethDeposited; // ETH escrowed by this bidder
        bool exists;
    }

    // ──────────────────────────── Constants ────────────────────────────

    uint256 public constant MIN_AUCTION_DURATION = 60; // 1 minute minimum
    uint256 public constant MAX_AUCTION_DURATION = 365 days;
    uint256 public constant MAX_BIDDERS = 500;

    // ──────────────────────────── State ────────────────────────────

    uint256 public auctionCounter;

    // auctionId => Auction
    mapping(uint256 => Auction) public auctions;

    // auctionId => bidder => Bid
    mapping(uint256 => mapping(address => Bid)) public bids;

    // auctionId => list of bidders (for iteration during finalize)
    mapping(uint256 => address[]) internal _bidders;

    // auctionId => total ETH escrowed
    mapping(uint256 => uint256) public totalEscrowed;

    // ──────────────────────────── Events ───────────────────────────

    event AuctionCreated(uint256 indexed auctionId, address seller, string title, uint256 biddingEnd);
    event BidSubmitted(uint256 indexed auctionId, address indexed bidder, uint256 ethDeposited);
    event AuctionFinalized(uint256 indexed auctionId, address winner, uint64 winningBid);
    event PaymentClaimed(uint256 indexed auctionId, address indexed seller, uint256 amount);
    event RefundClaimed(uint256 indexed auctionId, address indexed bidder, uint256 amount);

    // ──────────────────────────── Errors ───────────────────────────

    error AuctionDoesNotExist(uint256 auctionId);
    error BiddingPeriodEnded(uint256 auctionId);
    error BiddingPeriodActive(uint256 auctionId);
    error AuctionAlreadyFinalized(uint256 auctionId);
    error OnlySellerCanFinalize();
    error OnlySellerCanClaim();
    error SellerCannotBid(uint256 auctionId);
    error AlreadyBid(uint256 auctionId);
    error RevealNotReady();
    error NoBids(uint256 auctionId);
    error ZeroETHDeposit();
    error InvalidDuration(uint256 duration);
    error PaymentAlreadyClaimed();
    error NotWinner();
    error NoRefundAvailable();
    error WinnerCannotRefund();
    error MaxBiddersReached(uint256 auctionId);
    error BidderIndexOutOfBounds(uint256 index, uint256 length);

    // ─────────────────────────── Modifiers ─────────────────────────

    modifier auctionExists(uint256 auctionId) {
        if (auctions[auctionId].seller == address(0)) revert AuctionDoesNotExist(auctionId);
        _;
    }

    modifier biddingActive(uint256 auctionId) {
        if (block.timestamp >= auctions[auctionId].biddingEnd) revert BiddingPeriodEnded(auctionId);
        _;
    }

    modifier biddingEnded(uint256 auctionId) {
        if (block.timestamp < auctions[auctionId].biddingEnd) revert BiddingPeriodActive(auctionId);
        _;
    }

    modifier notFinalized(uint256 auctionId) {
        if (auctions[auctionId].finalized) revert AuctionAlreadyFinalized(auctionId);
        _;
    }

    // ────────────────────────── Create Auction ─────────────────────

    /// @notice Create a new sealed-bid auction
    /// @param title Human-readable item description
    /// @param duration Bidding window in seconds from now (must be between MIN and MAX)
    /// @param minimumBidEncrypted Encrypted minimum bid (InEuint64 from SDK)
    function createAuction(
        string calldata title,
        uint256 duration,
        InEuint64 calldata minimumBidEncrypted
    ) external returns (uint256 auctionId) {
        if (duration < MIN_AUCTION_DURATION || duration > MAX_AUCTION_DURATION) {
            revert InvalidDuration(duration);
        }

        auctionId = auctionCounter++;

        euint64 minimumBid = FHE.asEuint64(minimumBidEncrypted);
        euint64 initialBid = FHE.asEuint64(uint64(0));
        eaddress initialBidder = FHE.asEaddress(address(0));

        Auction storage a = auctions[auctionId];
        a.seller = msg.sender;
        a.title = title;
        a.biddingEnd = block.timestamp + duration;
        a.finalized = false;
        a.paymentClaimed = false;
        a.minimumBid = minimumBid;
        a.highestBid = initialBid;
        a.highestBidder = initialBidder;
        a.revealedBid = 0;
        a.revealedWinner = address(0);

        // Grant the contract permission to use these encrypted values later
        FHE.allowThis(a.minimumBid);
        FHE.allowThis(a.highestBid);
        FHE.allowThis(a.highestBidder);

        emit AuctionCreated(auctionId, msg.sender, title, a.biddingEnd);
    }

    // ────────────────────────── Place Bid ──────────────────────────

    /// @notice Submit a sealed bid with ETH deposit. The bid amount is never
    ///         visible on-chain until after finalization.
    /// @dev The encrypted bid is a ranking score. The winner pays their
    ///      ETH deposit (not the encrypted bid value) to the seller.
    /// @param auctionId The auction to bid on
    /// @param bidAmountEncrypted Encrypted bid amount (InEuint64 from SDK)
    function placeBid(uint256 auctionId, InEuint64 calldata bidAmountEncrypted)
        external
        payable
        auctionExists(auctionId)
        biddingActive(auctionId)
        notFinalized(auctionId)
    {
        Auction storage a = auctions[auctionId];

        // ── Seller cannot bid on own auction ──
        if (msg.sender == a.seller) revert SellerCannotBid(auctionId);

        // ── One bid per address ──
        if (bids[auctionId][msg.sender].exists) revert AlreadyBid(auctionId);

        // ── Max bidders cap ──
        if (_bidders[auctionId].length >= MAX_BIDDERS) revert MaxBiddersReached(auctionId);

        // Require escrow without exposing the encrypted reserve as plaintext.
        // Bid eligibility is enforced below with FHE.gte().
        if (msg.value == 0) revert ZeroETHDeposit();

        euint64 bidAmount = FHE.asEuint64(bidAmountEncrypted);

        // ── Enforce minimum bid (encrypted comparison) ──
        // FHE.ge returns ebool; FHE.select zeros out the bid if below min.
        // The contract never learns whether the bid was above or below.
        ebool meetsMinimum = FHE.gte(bidAmount, a.minimumBid);
        bidAmount = FHE.select(meetsMinimum, bidAmount, FHE.asEuint64(uint64(0)));

        // Store the (conditionally-zeroed) encrypted bid + ETH deposit
        Bid storage storedBid = bids[auctionId][msg.sender];
        storedBid.amount = bidAmount;
        storedBid.ethDeposited = msg.value;
        storedBid.exists = true;
        _bidders[auctionId].push(msg.sender);
        totalEscrowed[auctionId] += msg.value;

        // ── Encrypted winner comparison (CMUX) ──
        // FHE.select(cond, ifTrue, ifFalse) works like a hardware MUX:
        //   if cond == true  → returns ifTrue
        //   if cond == false → returns ifFalse
        //
        // We compare the new bid against the current highest entirely in
        // encrypted space. The ebool result of FHE.gt never leaves the
        // coprocessor in plaintext.

        ebool isNewHighest = FHE.gt(bidAmount, a.highestBid);

        // Update highest bid: select(newBid, oldBid) → max(old, new)
        a.highestBid = FHE.select(isNewHighest, bidAmount, a.highestBid);

        // Update highest bidder: select(newBidder, oldBidder)
        eaddress newBidder = FHE.asEaddress(msg.sender);
        a.highestBidder = FHE.select(isNewHighest, newBidder, a.highestBidder);

        // Re-grant contract-level access after mutation
        FHE.allowThis(a.highestBid);
        FHE.allowThis(a.highestBidder);

        // allowSender lets the bidder read their handle; allowThis lets the
        // contract reuse the stored handle during future encrypted execution.
        FHE.allowSender(storedBid.amount);
        FHE.allowThis(storedBid.amount);

        emit BidSubmitted(auctionId, msg.sender, msg.value);
    }

    // ────────────────────────── Finalize ───────────────────────────

    /// @notice End the auction and make the winner + amount publicly
    ///         decryptable. Only the seller can call this.
    /// @dev After this call, anyone can use the CoFHE SDK's
    ///      `decryptForTx(...).withoutPermit()` to get a signed plaintext,
    ///      then call `revealWinner` to store it on-chain.
    function finalize(uint256 auctionId)
        external
        auctionExists(auctionId)
        biddingEnded(auctionId)
        notFinalized(auctionId)
    {
        Auction storage a = auctions[auctionId];

        if (msg.sender != a.seller) revert OnlySellerCanFinalize();
        if (_bidders[auctionId].length == 0) revert NoBids(auctionId);

        a.finalized = true;

        // Make the encrypted winner data publicly decryptable.
        // After this, the Threshold Network will serve decryption for anyone.
        FHE.allowPublic(a.highestBid);
        FHE.allowPublic(a.highestBidder);
    }

    // ────────────────────────── Reveal Winner ──────────────────────

    /// @notice Publish the decrypted winner and winning bid on-chain.
    /// @dev Three-step flow (standard CoFHE pattern):
    ///      1. Contract calls `finalize()` → FHE.allowPublic on ctHashes
    ///      2. Client reads the ctHash getters, calls
    ///         `decryptForTx(ctHash).withoutPermit().execute()` for each
    ///      3. Client submits plaintext + signature here
    /// @param auctionId The auction to reveal
    /// @param bidCtHash The ciphertext hash of highestBid (from getHighestBidCtHash)
    /// @param bidDecrypted The plaintext winning bid amount
    /// @param bidSignature Threshold Network signature for the bid
    /// @param winnerCtHash The ciphertext hash of highestBidder (from getHighestBidderCtHash)
    /// @param winnerDecrypted The plaintext winner address
    /// @param winnerSignature Threshold Network signature for the winner
    function revealWinner(
        uint256 auctionId,
        euint64 bidCtHash,
        uint64 bidDecrypted,
        bytes calldata bidSignature,
        eaddress winnerCtHash,
        address winnerDecrypted,
        bytes calldata winnerSignature
    )
        external
        auctionExists(auctionId)
        biddingEnded(auctionId)
    {
        Auction storage a = auctions[auctionId];
        if (!a.finalized) revert RevealNotReady();
        if (a.revealedWinner != address(0)) revert AuctionAlreadyFinalized(auctionId);

        // Verify & store the Threshold Network signatures on-chain.
        // Reverts if the signature is invalid (tampered decrypt proof).
        FHE.publishDecryptResult(bidCtHash, bidDecrypted, bidSignature);
        FHE.publishDecryptResult(winnerCtHash, winnerDecrypted, winnerSignature);

        a.revealedBid = bidDecrypted;
        a.revealedWinner = winnerDecrypted;

        emit AuctionFinalized(auctionId, winnerDecrypted, bidDecrypted);
    }

    // ────────────────────────── Claim Payment ──────────────────────

    /// @notice Seller claims the winner's ETH deposit after reveal.
    /// @dev The winning bid (encrypted score) is separate from the ETH
    ///      deposit. The seller receives the winner's deposited ETH.
    /// @param auctionId The auction to claim payment from
    function claimPayment(uint256 auctionId)
        external
        nonReentrant
        auctionExists(auctionId)
    {
        Auction storage a = auctions[auctionId];

        if (msg.sender != a.seller) revert OnlySellerCanClaim();
        if (a.revealedWinner == address(0)) revert RevealNotReady();
        if (a.paymentClaimed) revert PaymentAlreadyClaimed();

        // Get the winner's ETH deposit
        uint256 payment = bids[auctionId][a.revealedWinner].ethDeposited;

        if (payment == 0) revert NoRefundAvailable();

        a.paymentClaimed = true;
        totalEscrowed[auctionId] -= payment;

        // Transfer ETH to seller
        (bool success, ) = payable(msg.sender).call{value: payment}("");
        require(success, "ETH transfer failed");

        emit PaymentClaimed(auctionId, msg.sender, payment);
    }

    // ────────────────────────── Claim Refund ───────────────────────

    /// @notice Losing bidders can claim their ETH refund after reveal
    /// @param auctionId The auction to claim refund from
    function claimRefund(uint256 auctionId)
        external
        nonReentrant
        auctionExists(auctionId)
    {
        Auction storage a = auctions[auctionId];

        if (a.revealedWinner == address(0)) revert RevealNotReady();
        if (msg.sender == a.revealedWinner) revert WinnerCannotRefund();

        Bid storage bid = bids[auctionId][msg.sender];
        if (!bid.exists) revert NoRefundAvailable();
        if (bid.ethDeposited == 0) revert NoRefundAvailable();

        uint256 refundAmount = bid.ethDeposited;
        bid.ethDeposited = 0; // Prevent double refund
        totalEscrowed[auctionId] -= refundAmount;

        // Transfer ETH back to bidder
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "ETH transfer failed");

        emit RefundClaimed(auctionId, msg.sender, refundAmount);
    }

    // ────────────────────────── View Helpers ───────────────────────

    /// @notice Returns the encrypted highest bid ciphertext hash
    function getHighestBidCtHash(uint256 auctionId)
        external
        view
        auctionExists(auctionId)
        returns (euint64)
    {
        return auctions[auctionId].highestBid;
    }

    /// @notice Returns the encrypted highest bidder ciphertext hash
    function getHighestBidderCtHash(uint256 auctionId)
        external
        view
        auctionExists(auctionId)
        returns (eaddress)
    {
        return auctions[auctionId].highestBidder;
    }

    /// @notice Returns the number of bidders for an auction
    function getBidderCount(uint256 auctionId)
        external
        view
        auctionExists(auctionId)
        returns (uint256)
    {
        return _bidders[auctionId].length;
    }

    /// @notice Returns a specific bidder address by index
    function getBidder(uint256 auctionId, uint256 index)
        external
        view
        auctionExists(auctionId)
        returns (address)
    {
        address[] storage bidders = _bidders[auctionId];
        if (index >= bidders.length) revert BidderIndexOutOfBounds(index, bidders.length);
        return bidders[index];
    }

    /// @notice Returns the ETH deposit for a specific bidder
    function getBidderDeposit(uint256 auctionId, address bidder)
        external
        view
        auctionExists(auctionId)
        returns (uint256)
    {
        return bids[auctionId][bidder].ethDeposited;
    }

    /// @notice Returns whether the auction payment has been claimed
    function isPaymentClaimed(uint256 auctionId)
        external
        view
        auctionExists(auctionId)
        returns (bool)
    {
        return auctions[auctionId].paymentClaimed;
    }

}
