import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useBalance,
} from "wagmi";
import { useCofheClient } from "@cofhe/react";
import { Encryptable } from "@cofhe/sdk";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Clock,
  Users,
  Lock,
  Trophy,
  AlertCircle,
  Gift,
  Wallet,
  ArrowDownToLine,
  ShieldCheck,
  Gavel,
  Eye,
} from "lucide-react";
import { CountdownTimer } from "../components";
import { BidFlow_ADDRESS, BidFlow_ABI } from "../constants/contracts";
import { formatEth, shortAddr } from "../utils/format";
import { parseAuction, ZERO_ADDRESS } from "../utils/auction";
import type { Auction } from "../types";

export function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const auctionId = id && /^\d+$/.test(id) ? BigInt(id) : null;

  const { data: walletBalance } = useBalance({
    address,
    query: { enabled: !!address },
  });

  const [bidAmount, setBidAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.001");
  const [error, setError] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);

  const {
    data: auction,
    isLoading: auctionLoading,
    refetch,
  } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: auctionId !== null ? [auctionId] : undefined,
    query: { enabled: auctionId !== null },
  });

  const { data: bidCount, isLoading: isLoadingBidCount } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "getBidderCount",
    args: auctionId !== null ? [auctionId] : undefined,
    query: { enabled: auctionId !== null },
  });

  const { data: userBid, isLoading: isLoadingUserBid } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "bids",
    args:
      auctionId !== null
        ? [auctionId, address || "0x0000000000000000000000000000000000000000"]
        : undefined,
    query: { enabled: !!address && auctionId !== null },
  });

  const { data: userDeposit } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "getBidderDeposit",
    args:
      auctionId !== null
        ? [auctionId, address || "0x0000000000000000000000000000000000000000"]
        : undefined,
    query: { enabled: !!address && auctionId !== null },
  });

  const { data: highestBidCtHash } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "getHighestBidCtHash",
    args: auctionId !== null ? [auctionId] : undefined,
    query: { enabled: auctionId !== null },
  });

  const { data: highestBidderCtHash } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "getHighestBidderCtHash",
    args: auctionId !== null ? [auctionId] : undefined,
    query: { enabled: auctionId !== null },
  });

  const cofheClient = useCofheClient();

  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const [showBidConfirm, setShowBidConfirm] = useState(false);
  const userDepositAmount = typeof userDeposit === "bigint" ? userDeposit : 0n;

  const {
    data: hash,
    isPending: isTxPending,
    writeContract,
    error: txError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Derived state
  let auctionData: Auction | null = null;
  let isBiddingActive = false;
  let isSeller = false;
  let hasBid = false;
  let isWinner = false;
  let canClaimRefund = false;

  if (auction && Array.isArray(auction)) {
    auctionData = parseAuction(auction as unknown[], Number(auctionId ?? 0));
    if (auctionData) {
      isBiddingActive = auctionData.status === "ACTIVE";
      isSeller =
        !!address && auctionData.seller.toLowerCase() === address.toLowerCase();
      hasBid = userBid ? (userBid as { exists: boolean }).exists : false;
      isWinner =
        auctionData.revealedWinner !== ZERO_ADDRESS &&
        !!address &&
        auctionData.revealedWinner.toLowerCase() === address.toLowerCase();
      canClaimRefund =
        hasBid &&
        !isWinner &&
        auctionData.finalized &&
        auctionData.revealedWinner !== ZERO_ADDRESS &&
        userDepositAmount > 0n;
    }
  }

  const shouldTriggerConfetti =
    !!auctionData?.finalized &&
    auctionData.revealedWinner !== ZERO_ADDRESS &&
    !hasTriggeredConfetti;

  useEffect(() => {
    if (shouldTriggerConfetti) {
      import("canvas-confetti").then((mod) => {
        mod.default({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#2DD4BF", "#C9922A", "#22C55E"],
        });
      });
      window.setTimeout(() => setHasTriggeredConfetti(true), 0);
    }
  }, [shouldTriggerConfetti]);

  // Handlers
  const handlePlaceBid = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!address) {
        setError("Please connect your wallet");
        return;
      }
      if (!auctionData || !isBiddingActive) {
        setError("Bidding is not active for this auction");
        return;
      }
      if (hasBid) {
        setError("You have already placed a bid on this auction");
        return;
      }
      if (auctionId === null) {
        setError("Invalid auction ID");
        return;
      }
      const bidValue = parseFloat(bidAmount);
      if (isNaN(bidValue) || bidValue <= 0) {
        setError("Please enter a valid bid amount");
        return;
      }
      const depositValue = parseFloat(depositAmount);
      if (isNaN(depositValue) || depositValue <= 0) {
        setError("Please enter a valid escrow bond");
        return;
      }
      if (!cofheClient) {
        setError(
          "FHE encryption client not loaded. Please wait a moment and try again.",
        );
        return;
      }
      // Show confirmation
      setShowBidConfirm(true);
    },
    [
      address,
      auctionData,
      isBiddingActive,
      hasBid,
      bidAmount,
      depositAmount,
      cofheClient,
      auctionId,
    ],
  );

  const confirmBid = useCallback(async () => {
    setShowBidConfirm(false);
    const bidValue = parseFloat(bidAmount);
    const depositValue = parseFloat(depositAmount);
    const depositWei = BigInt(Math.round(depositValue * 1e18));
    try {
      setIsEncrypting(true);
      setError(null);

      // Step 1: Encrypt bid
      let encryptedResults;
      try {
        encryptedResults = await cofheClient!
          .encryptInputs([
            Encryptable.uint64(BigInt(Math.round(bidValue * 1e18))),
          ])
          .execute();
      } catch (encryptErr) {
        const msg =
          encryptErr instanceof Error ? encryptErr.message : String(encryptErr);
        if (
          msg.includes("TFHE") ||
          msg.includes("WASM") ||
          msg.includes("tfhe")
        ) {
          throw new Error(
            "FHE encryption failed — the TFHE library could not load. This is a testnet limitation. Please refresh and try again.",
            { cause: encryptErr },
          );
        }
        if (
          msg.includes("network") ||
          msg.includes("fetch") ||
          msg.includes("connection")
        ) {
          throw new Error(
            "Network error during encryption. Please check your connection and try again.",
            { cause: encryptErr },
          );
        }
        throw new Error(`Encryption failed: ${msg}`, { cause: encryptErr });
      }

      setIsEncrypting(false);
      const encrypted = encryptedResults[0];
      const inEuint64 = {
        ctHash: encrypted.ctHash,
        securityZone: encrypted.securityZone,
        utype: encrypted.utype,
        signature: encrypted.signature as `0x${string}`,
      };

      // Step 2: Submit transaction
      writeContract({
        address: BidFlow_ADDRESS,
        abi: BidFlow_ABI,
        functionName: "placeBid",
        args: [auctionId, inEuint64],
        value: depositWei,
      });
    } catch (err) {
      setIsEncrypting(false);
      const message =
        err instanceof Error ? err.message : "Failed to submit bid";
      setError(message);
      console.error("[PlaceBid] Error:", err);
    }
  }, [bidAmount, depositAmount, cofheClient, writeContract, auctionId]);

  const handleFinalize = useCallback(() => {
    if (!auctionData || !isSeller || auctionId === null) return;
    writeContract({
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "finalize",
      args: [auctionId],
    });
  }, [auctionData, isSeller, writeContract, auctionId]);

  const handleReveal = useCallback(async () => {
    if (!auctionData?.finalized || auctionData.revealedWinner !== ZERO_ADDRESS)
      return;
    try {
      if (!cofheClient) {
        setError("Cofhe client not initialized");
        return;
      }
      // Try decryptForTx (produces Threshold Network signatures)
      if (typeof cofheClient.decryptForTx === "function") {
        const bidResult = await cofheClient
          .decryptForTx(highestBidCtHash as `0x${string}`)
          .withoutPermit()
          .execute();
        const winnerResult = await cofheClient
          .decryptForTx(highestBidderCtHash as `0x${string}`)
          .withoutPermit()
          .execute();
        if (bidResult && winnerResult) {
          const winnerAddress =
            "0x" +
            BigInt(winnerResult.decryptedValue).toString(16).padStart(40, "0");
          writeContract({
            address: BidFlow_ADDRESS,
            abi: BidFlow_ABI,
            functionName: "revealWinner",
            args: [
              auctionId,
              bidResult.ctHash,
              bidResult.decryptedValue,
              bidResult.signature,
              winnerResult.ctHash,
              winnerAddress,
              winnerResult.signature,
            ],
          });
        }
      } else {
        toast.info(
          "Use Reveal Center to reveal winners with Threshold Network signatures",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reveal winner");
    }
  }, [
    auctionData,
    cofheClient,
    highestBidCtHash,
    highestBidderCtHash,
    writeContract,
    auctionId,
  ]);

  const handleClaimPayment = useCallback(() => {
    if (!auctionData || !isSeller || auctionId === null) return;
    writeContract({
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "claimPayment",
      args: [auctionId],
    });
  }, [auctionData, isSeller, writeContract, auctionId]);

  const handleClaimRefund = useCallback(() => {
    if (!canClaimRefund || auctionId === null) return;
    writeContract({
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "claimRefund",
      args: [auctionId],
    });
  }, [canClaimRefund, writeContract, auctionId]);

  useEffect(() => {
    if (hash) toast.loading("Processing transaction...", { id: hash });
  }, [hash]);

  useEffect(() => {
    if (isConfirmed && hash) {
      toast.success("Transaction confirmed!", { id: hash });
      refetch();
    }
  }, [isConfirmed, hash, refetch]);

  useEffect(() => {
    if (txError) toast.error(txError.message || "Transaction failed");
  }, [txError]);

  const isLoading =
    isEncrypting || isTxPending || isConfirming || isLoadingUserBid;
  const bidCountNumber = isLoadingBidCount ? undefined : Number(bidCount || 0);
  const statusLabel = auctionData?.finalized
    ? "Finalized"
    : isBiddingActive
      ? "Accepting bids"
      : "Bidding ended";
  const statusClass = auctionData?.finalized
    ? "sb-badge--finalized"
    : isBiddingActive
      ? "sb-badge--active"
      : "sb-badge--ended-warn";

  if (auctionLoading || auctionId === null) {
    if (auctionId === null) {
      return (
        <div className="sb-detail-notfound">
          <main className="sb-detail-notfound-body">
            <h2>Invalid auction ID</h2>
            <p>The auction ID "{id}" is not valid.</p>
            <Link to="/">Return to Home</Link>
          </main>
        </div>
      );
    }
    return (
      <div className="sb-detail-loading">
        <svg
          className="sb-detail-spinner"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="sb-toast__spin-bg"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="sb-toast__spin-fg"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p>Loading auction...</p>
      </div>
    );
  }

  if (!auctionData) {
    return (
      <div className="sb-detail-notfound">
        <main className="sb-detail-notfound-body">
          <h2>Auction not found</h2>
          <Link to="/">Return to Home</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="sb-detail">
      {/* Breadcrumbs */}
      <nav className="sb-breadcrumbs">
        <Link to="/" className="sb-breadcrumbs__link">
          Home
        </Link>
        <span className="sb-breadcrumbs__sep">/</span>
        <Link to="/auctions" className="sb-breadcrumbs__link">
          Auctions
        </Link>
        <span className="sb-breadcrumbs__sep">/</span>
        <span className="sb-breadcrumbs__current">
          #{auctionId!.toString()}
        </span>
      </nav>

      <main className="sb-detail-main">
        {/* Left Column */}
        <div className="sb-detail-left">
          {/* Auction Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sb-detail-info"
          >
            {auctionData.imageURI && (
              <img
                src={auctionData.imageURI}
                alt={auctionData.title}
                className="sb-detail-info__image"
              />
            )}
            <div className="sb-detail-info__header">
              <div>
                <div className="sb-detail-kicker">
                  <ShieldCheck size={14} />
                  <span>#{auctionId!.toString()}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{auctionData.category || "Auction"}</span>
                </div>
                <h1 className="sb-detail-info__title">{auctionData.title}</h1>
                <div className="sb-detail-info__tag">
                  <Lock size={14} /> Encrypted Sealed-Bid
                </div>
              </div>
              <span className={`sb-badge ${statusClass}`}>{statusLabel}</span>
            </div>

            {auctionData.description && (
              <p className="sb-detail-info__desc">{auctionData.description}</p>
            )}

            <div className="sb-detail-stats">
              <div className="sb-dashboard-stat">
                <span className="sb-dashboard-stat__label">
                  <Clock size={14} /> Time Left
                </span>
                <CountdownTimer
                  endTime={auctionData.biddingEnd}
                  onComplete={() => refetch()}
                />
              </div>
              <div className="sb-dashboard-stat">
                <span className="sb-dashboard-stat__label">
                  <Users size={14} /> Bidders
                </span>
                <span className="sb-dashboard-stat__value">
                  {bidCountNumber === undefined ? "..." : bidCountNumber}
                </span>
              </div>
              <div className="sb-dashboard-stat">
                <span className="sb-dashboard-stat__label">
                  <Lock size={14} /> Seller
                </span>
                <span className="sb-dashboard-stat__value sb-detail-stat-value--seller">
                  {shortAddr(auctionData.seller)}
                  {isSeller && <span className="sb-detail-you">(You)</span>}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Settlement Result — only shown after reveal */}
          {(bidCountNumber ?? 0) > 0 &&
          auctionData.revealedWinner !== ZERO_ADDRESS ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="sb-detail-highest"
            >
              <h2 className="sb-detail-highest__title">
                <Trophy size={20} /> Settlement Result
              </h2>
              <div className="sb-detail-highest__revealed">
                <div className="sb-detail-highest__amount">
                  <p className="sb-detail-highest__amount-label">Winning Bid</p>
                  <p className="sb-detail-highest__amount-value gradient-text">
                    {formatEth(auctionData.revealedBid)} ETH
                  </p>
                </div>
                <div className="sb-detail-highest__winner">
                  <div className="sb-detail-trophy-circle">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <p className="sb-detail-highest__winner-label">Winner</p>
                    <p className="sb-detail-mono">
                      {shortAddr(auctionData.revealedWinner)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="sb-detail-empty-bids"
            >
              <div className="sb-detail-lock-circle">
                <Gavel size={20} />
              </div>
              <div>
                <h2>No bids yet</h2>
                <p>
                  Be the first bidder. Your bid amount stays encrypted until the
                  auction closes.
                </p>
              </div>
            </motion.div>
          )}

          {/* Privacy Model */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="sb-detail-privacy-model"
          >
            <h3>
              <Lock size={16} /> Privacy Model
            </h3>
            <div className="sb-detail-privacy-grid">
              <div className="sb-detail-privacy-item sb-detail-privacy-item--public">
                <Eye size={14} />
                <div>
                  <strong>Public</strong>
                  <span>Asset, timing, bidder count</span>
                </div>
              </div>
              <div className="sb-detail-privacy-item sb-detail-privacy-item--private">
                <Lock size={14} />
                <div>
                  <strong>Private</strong>
                  <span>Your bid, reserve price</span>
                </div>
              </div>
              <div className="sb-detail-privacy-item sb-detail-privacy-item--verified">
                <ShieldCheck size={14} />
                <div>
                  <strong>Verified</strong>
                  <span>Winner via Threshold proof</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column — Action Panels */}
        <div className="sb-detail-right">
          <div className="sb-detail-actions">
            {/* Place Bid */}
            {isBiddingActive && !isSeller && !hasBid && !isLoadingUserBid && (
              <ActionPanel title="Place Your Bid">
                <form onSubmit={handlePlaceBid} className="sb-detail-form">
                  <div className="sb-form-field">
                    <label className="sb-form-label" htmlFor="bidAmount">
                      Bid Amount (ETH)
                    </label>
                    <input
                      type="number"
                      id="bidAmount"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="0.5"
                      step="0.0001"
                      min="0.0001"
                      className="sb-input sb-input--mono"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="sb-form-field">
                    <label className="sb-form-label" htmlFor="depositAmount">
                      Escrow Bond (ETH)
                    </label>
                    <input
                      type="number"
                      id="depositAmount"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.001"
                      step="0.0001"
                      min="0.0001"
                      className="sb-input sb-input--mono"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="sb-detail-deposit-notice">
                    <div className="sb-detail-deposit-notice__header">
                      <Wallet size={16} /> Privacy-Preserving Escrow Bond
                    </div>
                    <p>
                      The public bond is intentionally separate from your
                      encrypted bid, so transaction value does not reveal your
                      bid amount. Losing bidders can claim a full refund.
                    </p>
                  </div>
                  <p className="sb-detail-form-note">
                    <Lock size={12} /> Your bid amount is encrypted in-browser
                    before submission. Other participants cannot see your bid.
                  </p>
                  <p className="sb-detail-form-note sb-detail-form-note--warn">
                    <AlertCircle size={12} /> Bids below the seller's encrypted
                    minimum are zeroed by FHE comparison without revealing the
                    reserve.
                  </p>
                  {error && (
                    <div className="sb-detail-error" role="alert">
                      <AlertCircle size={20} />
                      <p>{error}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || isEncrypting || !cofheClient}
                    className="btn-primary sb-detail-action-btn"
                  >
                    {isEncrypting
                      ? "Encrypting..."
                      : isTxPending || isConfirming
                        ? "Processing..."
                        : "Encrypt & Submit Bid"}
                  </button>
                  <p className="sb-detail-form-note">
                    Your bid is encrypted before leaving your browser
                  </p>
                </form>
              </ActionPanel>
            )}

            {/* Cannot Bid - Seller */}
            {isBiddingActive && isSeller && (
              <ActionPanel title="Your Auction">
                <div className="sb-detail-cannot-bid">
                  <ShieldCheck size={20} />
                  <div>
                    <p>You created this auction.</p>
                    <p className="sb-detail-cannot-bid-sub">
                      Sellers cannot bid on their own auctions.
                    </p>
                  </div>
                </div>
              </ActionPanel>
            )}

            {/* Cannot Bid - Ended */}
            {!isBiddingActive &&
              !isSeller &&
              !hasBid &&
              !auctionData.finalized && (
                <ActionPanel title="Bidding Ended">
                  <div className="sb-detail-cannot-bid">
                    <Clock size={20} />
                    <div>
                      <p>The bidding period for this auction has ended.</p>
                      <p className="sb-detail-cannot-bid-sub">
                        Wait for the seller to finalize the auction.
                      </p>
                    </div>
                  </div>
                </ActionPanel>
              )}

            {/* Already Bid */}
            {hasBid && isBiddingActive && (
              <ActionPanel>
                <div className="sb-detail-already-bid">
                  <Lock size={20} />
                  <div>
                    <p>You have already placed a bid on this auction.</p>
                    {userDepositAmount > 0n && (
                      <p className="sb-detail-deposit-info">
                        Your deposit: {formatEth(userDepositAmount)} ETH
                      </p>
                    )}
                  </div>
                </div>
              </ActionPanel>
            )}

            {/* Finalize */}
            {isSeller &&
              !isBiddingActive &&
              !auctionData.finalized &&
              Number(bidCount || 0) > 0 && (
                <ActionPanel title="Finalize Auction">
                  <p className="sb-detail-action-desc">
                    Bidding has ended. Finalize to close the auction and prepare
                    for settlement. This action cannot be undone.
                  </p>
                  <div className="sb-detail-info-mini">
                    <Lock size={14} />
                    <span>
                      All bids remain encrypted. Only the winner will be
                      revealed.
                    </span>
                  </div>
                  <button
                    onClick={handleFinalize}
                    disabled={isLoading}
                    className="btn-primary sb-detail-action-btn"
                  >
                    {isTxPending || isConfirming
                      ? "Processing..."
                      : "Finalize Auction"}
                  </button>
                </ActionPanel>
              )}

            {/* Reveal */}
            {auctionData.finalized &&
              auctionData.revealedWinner === ZERO_ADDRESS && (
                <ActionPanel title="Reveal Winner">
                  <p className="sb-detail-action-desc">
                    The auction is finalized. Decrypt and publish the winner
                    on-chain using the Threshold Network.
                  </p>
                  <div className="sb-detail-info-mini">
                    <Eye size={14} />
                    <span>
                      Anyone can reveal — winner identity is cryptographically
                      verified.
                    </span>
                  </div>
                  <button
                    onClick={handleReveal}
                    disabled={isLoading}
                    className="btn-primary sb-detail-action-btn"
                  >
                    Reveal Winner
                  </button>
                </ActionPanel>
              )}

            {/* Claim Payment */}
            {isSeller &&
              auctionData.finalized &&
              auctionData.revealedWinner !== ZERO_ADDRESS &&
              !auctionData.paymentClaimed && (
                <ActionPanel
                  title={
                    <>
                      <Wallet size={20} /> Claim Payment
                    </>
                  }
                >
                  <p className="sb-detail-action-desc">
                    The auction has ended and the winner has been revealed. You
                    can now claim the winning bid amount.
                  </p>
                  <div className="sb-detail-green-box">
                    Winning bid: {formatEth(auctionData.revealedBid)} ETH
                  </div>
                  <button
                    onClick={handleClaimPayment}
                    disabled={isLoading}
                    className="btn-primary sb-detail-action-btn"
                  >
                    <ArrowDownToLine size={20} />{" "}
                    {isTxPending || isConfirming
                      ? "Processing..."
                      : "Claim Payment"}
                  </button>
                </ActionPanel>
              )}

            {/* Payment Claimed */}
            {isSeller && auctionData.paymentClaimed && (
              <div className="sb-detail-success-box">
                <Gift size={20} /> Payment has been claimed!
              </div>
            )}

            {/* Winner */}
            {isWinner &&
              auctionData.finalized &&
              auctionData.revealedWinner !== ZERO_ADDRESS && (
                <div className="sb-detail-winner-box">
                  <div className="sb-detail-winner-box__header">
                    <div className="sb-detail-trophy-circle">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <h2>Congratulations!</h2>
                      <p>You won this auction</p>
                    </div>
                  </div>
                  <p>
                    The seller will receive your bid payment. Thank you for
                    participating!
                  </p>
                </div>
              )}

            {/* Refund */}
            {canClaimRefund && (
              <ActionPanel
                title={
                  <>
                    <ArrowDownToLine size={20} /> Claim Refund
                  </>
                }
              >
                <p className="sb-detail-action-desc">
                  Unfortunately, you didn't win this auction. You can claim a
                  full refund of your deposited ETH.
                </p>
                <div className="sb-detail-amber-box">
                  Your deposit: {formatEth(userDepositAmount)} ETH
                </div>
                <button
                  onClick={handleClaimRefund}
                  disabled={isLoading}
                  className="btn-primary sb-detail-action-btn"
                >
                  <ArrowDownToLine size={20} />{" "}
                  {isTxPending || isConfirming
                    ? "Processing..."
                    : "Claim Refund"}
                </button>
              </ActionPanel>
            )}

            {/* Refund Claimed */}
            {hasBid &&
              !isWinner &&
              auctionData.finalized &&
              auctionData.revealedWinner !== ZERO_ADDRESS &&
              userDepositAmount === 0n && (
                <div className="sb-detail-success-box">
                  <Gift size={20} /> Refund has been claimed!
                </div>
              )}
          </div>
        </div>
      </main>

      {/* Bid Confirmation Dialog */}
      {showBidConfirm && (
        <div
          className="sb-confirm-overlay"
          onClick={() => setShowBidConfirm(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="sb-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sb-confirm-header">
              <Lock size={20} />
              <h3>Confirm Your Bid</h3>
            </div>
            <div className="sb-confirm-body">
              <div className="sb-confirm-row">
                <span>Bid Amount</span>
                <strong>Encrypted before submission</strong>
              </div>
              <div className="sb-confirm-row">
                <span>Public Escrow Bond</span>
                <strong>{depositAmount} ETH</strong>
              </div>
              <div className="sb-confirm-row">
                <span>Your Balance</span>
                <strong
                  className={
                    walletBalance &&
                    BigInt(Math.round(parseFloat(depositAmount) * 1e18)) >
                      walletBalance.value
                      ? "sb-confirm-insufficient"
                      : ""
                  }
                >
                  {walletBalance
                    ? `${Number(walletBalance.formatted).toFixed(4)} ETH`
                    : "Loading..."}
                </strong>
              </div>
              {walletBalance &&
                BigInt(Math.round(parseFloat(depositAmount) * 1e18)) >
                  walletBalance.value && (
                  <div className="sb-confirm-warning">
                    <AlertCircle size={16} />
                    <span>
                      Insufficient balance. You need more ETH on Arbitrum
                      Sepolia.
                    </span>
                  </div>
                )}
              <div className="sb-confirm-divider" />
              <p className="sb-confirm-note">
                Your bid will be encrypted in-browser before submission. No one
                can see your bid amount. This action cannot be undone.
              </p>
            </div>
            <div className="sb-confirm-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowBidConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={confirmBid}
                disabled={
                  walletBalance &&
                  BigInt(Math.round(parseFloat(depositAmount) * 1e18)) >
                    walletBalance.value
                }
              >
                Confirm & Submit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ActionPanel({
  title,
  children,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card sb-detail-action-panel"
    >
      {title && <h2 className="sb-detail-action-title">{title}</h2>}
      {children}
    </motion.div>
  );
}

export default AuctionDetail;
