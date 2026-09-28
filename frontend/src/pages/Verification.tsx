import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2, Circle, Trophy, Gavel } from "lucide-react";
import { EmptyState } from "../components";
import { BidFlow_ADDRESS, BidFlow_ABI } from "../constants/contracts";
import { parseAuction } from "../utils/auction";
import { shortAddr } from "../utils/format";
export function Verification() {
  const { data: auctionCounter, isLoading: isLoadingCounter } = useReadContract(
    {
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "auctionCounter",
    },
  );

  const totalAuctions = auctionCounter ? Number(auctionCounter) : 0;
  const auctionIds = useMemo(
    () =>
      Array.from({ length: totalAuctions }, (_, i) => totalAuctions - 1 - i),
    [totalAuctions],
  );

  return (
    <div className="sb-page-new">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sb-page-new__header"
      >
        <ShieldCheck size={24} className="icon-cipher" />
        <div>
          <h1 className="sb-page-new__title">Verification</h1>
          <p className="sb-page-new__sub">
            On-chain proof and verification feed
          </p>
        </div>
      </motion.div>

      {isLoadingCounter ? (
        <div className="sb-table-empty">Loading...</div>
      ) : totalAuctions === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No verification events yet"
          description="Verification events will appear here as auctions are created, bid, and settled."
        />
      ) : (
        <div className="sb-verification-feed">
          <div className="sb-dashboard-table-header">
            <span className="sb-dashboard-table-title">
              <ShieldCheck size={14} className="icon-cipher" /> Verification
              Events
            </span>
          </div>
          {auctionIds.map((id) => (
            <VerificationItem key={id} auctionId={id} />
          ))}
        </div>
      )}
    </div>
  );
}

function VerificationItem({ auctionId }: { auctionId: number }) {
  const { data: auction } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: [BigInt(auctionId)],
  });

  const { data: bidCount, isLoading: isLoadingBidCount } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "getBidderCount",
    args: [BigInt(auctionId)],
  });

  if (!auction)
    return (
      <div className="sb-verification-feed__item" style={{ opacity: 0.3 }}>
        <span>&nbsp;</span>
        <span>&nbsp;</span>
      </div>
    );

  const bidders = isLoadingBidCount ? undefined : Number(bidCount || 0);
  const data = parseAuction(auction as unknown[], auctionId, bidders);
  if (!data) return null;

  return (
    <>
      {/* Auction created */}
      <div className="sb-verification-feed__item">
        <CheckCircle2
          size={14}
          className="sb-verification-feed__icon sb-verification-feed__icon--done"
        />
        <span>Auction created — {data.title}</span>
        <span
          style={{ marginLeft: "auto", color: "var(--t3)", fontSize: "10px" }}
        >
          Seller: {shortAddr(data.seller)}
        </span>
      </div>

      {/* Bid commitments */}
      {bidders > 0 && (
        <div className="sb-verification-feed__item">
          <CheckCircle2
            size={14}
            className="sb-verification-feed__icon sb-verification-feed__icon--done"
          />
          <span>
            {bidders} bid commitment{bidders !== 1 ? "s" : ""} recorded
          </span>
          <span
            style={{ marginLeft: "auto", color: "var(--t3)", fontSize: "10px" }}
          >
            FHE encrypted
          </span>
        </div>
      )}

      {/* Escrow locked */}
      {bidders > 0 && (
        <div className="sb-verification-feed__item">
          <CheckCircle2
            size={14}
            className="sb-verification-feed__icon sb-verification-feed__icon--done"
          />
          <span>Escrow locked — {bidders} deposits secured</span>
        </div>
      )}

      {/* Finalization */}
      {data.status !== "ACTIVE" && (
        <div className="sb-verification-feed__item">
          <CheckCircle2
            size={14}
            className="sb-verification-feed__icon sb-verification-feed__icon--done"
          />
          <span>Auction finalized — bids decryptable</span>
        </div>
      )}

      {/* Winner revealed */}
      {data.status === "FINALIZED" && (
        <div className="sb-verification-feed__item">
          <Trophy
            size={14}
            className="sb-verification-feed__icon"
            style={{ color: "var(--gold)" }}
          />
          <span>Winner revealed — {shortAddr(data.revealedWinner)}</span>
          <span
            style={{
              marginLeft: "auto",
              color: "var(--gold)",
              fontSize: "10px",
            }}
          >
            Winning bid:{" "}
            {data.revealedBid > 0n ? `${data.revealedBid.toString()} wei` : "—"}
          </span>
        </div>
      )}

      {/* Pending */}
      {data.status === "ACTIVE" && (
        <div className="sb-verification-feed__item">
          <Circle
            size={14}
            className="sb-verification-feed__icon"
            style={{ color: "var(--t4)" }}
          />
          <span style={{ color: "var(--t3)" }}>Winner proof pending</span>
        </div>
      )}
    </>
  );
}

export default Verification;
