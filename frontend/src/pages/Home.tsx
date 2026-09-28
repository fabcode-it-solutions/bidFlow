import { Link } from "react-router-dom";
import { useReadContract, useAccount } from "wagmi";
import { motion } from "framer-motion";
import {
  Plus,
  Gavel,
  Lock,
  Clock,
  Users,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Zap,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { CountdownTimer, EmptyState } from "../components";
import { BidFlow_ADDRESS, BidFlow_ABI } from "../constants/contracts";
import { formatEth } from "../utils/format";
import { parseAuction } from "../utils/auction";
import { useCurrentTimestamp } from "../hooks/useCurrentTimestamp";

export function Home() {
  const { address } = useAccount();
  const now = useCurrentTimestamp();

  const { data: auctionCounter, isLoading: isLoadingCounter } = useReadContract(
    {
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "auctionCounter",
    },
  );

  const { data: totalEscrowed, isLoading: isLoadingEscrowed } = useReadContract(
    {
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "totalEscrowed",
    },
  );

  const totalAuctions = auctionCounter ? Number(auctionCounter) : 0;

  return (
    <div className="sb-dashboard-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sb-dashboard-page__header"
      >
        <h1 className="sb-dashboard-page__title">Sealed-Bid Auctions on FHE</h1>
        <p className="sb-dashboard-page__sub">
          Public asset. Private bids. Verifiable settlement.
        </p>
      </motion.div>

      {/* Privacy Model */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="sb-privacy-model"
      >
        <div className="sb-privacy-model__item sb-privacy-model__item--public">
          <Eye size={16} />
          <div>
            <strong>Public</strong>
            <span>Asset details, auction timing, bidder count</span>
          </div>
        </div>
        <div className="sb-privacy-model__item sb-privacy-model__item--private">
          <Lock size={16} />
          <div>
            <strong>Private</strong>
            <span>Bid amounts, reserve price, winner identity</span>
          </div>
        </div>
        <div className="sb-privacy-model__item sb-privacy-model__item--verified">
          <ShieldCheck size={16} />
          <div>
            <strong>Verified</strong>
            <span>Winner revealed via Threshold Network proof</span>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="sb-dashboard-actions"
      >
        <Link to="/create" className="btn-primary">
          <Plus size={16} /> Create Auction
        </Link>
        <Link to="/auctions" className="btn-ghost">
          <Gavel size={16} /> Place Sealed Bid
        </Link>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="sb-dashboard-stats"
      >
        <DashboardStat
          label="Active Auctions"
          value={isLoadingCounter ? "..." : totalAuctions.toString()}
          sub="on Arbitrum Sepolia"
          accent="cipher"
        />
        <DashboardStat
          label="Total Locked"
          value={
            isLoadingEscrowed
              ? "..."
              : totalEscrowed
                ? `${formatEth(totalEscrowed as bigint)} ETH`
                : "0 ETH"
          }
          sub="in escrow"
          accent="gold"
        />
        <RevealDueStat totalAuctions={totalAuctions} now={now} />
        <DashboardStat
          label="Privacy"
          value="Sealed"
          sub="FHE encrypted"
          accent="cipher"
        />
      </motion.div>

      {/* Featured + Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="sb-dashboard-grid"
      >
        <FeaturedAuction
          totalAuctions={totalAuctions}
          isLoading={isLoadingCounter}
        />
        <AuctionPhaseTimeline
          totalAuctions={totalAuctions}
          now={now}
          isLoading={isLoadingCounter}
        />
      </motion.div>

      {/* Live Auctions Table + My Bids */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="sb-dashboard-grid"
      >
        <LiveAuctionsTable
          totalAuctions={totalAuctions}
          now={now}
          isLoading={isLoadingCounter}
        />
        <MySealedBidStatus
          totalAuctions={totalAuctions}
          address={address}
          now={now}
        />
      </motion.div>

      {/* Verification Feed */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <VerificationFeed totalAuctions={totalAuctions} />
      </motion.div>
    </div>
  );
}

/* ───────────────────── Sub-components ───────────────────── */

function DashboardStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "gold" | "cipher";
}) {
  return (
    <div className="sb-dashboard-stat">
      <span className="sb-dashboard-stat__label">{label}</span>
      <span
        className={`sb-dashboard-stat__value sb-dashboard-stat__value--${accent}`}
      >
        {value}
      </span>
      <span className="sb-dashboard-stat__sub">{sub}</span>
    </div>
  );
}

function RevealDueStat({
  totalAuctions,
  now,
}: {
  totalAuctions: number;
  now: bigint;
}) {
  const latestAuctionId = totalAuctions > 0 ? totalAuctions - 1 : null;
  const { data: latestAuction } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: latestAuctionId !== null ? [BigInt(latestAuctionId)] : undefined,
    query: { enabled: latestAuctionId !== null },
  });

  if (!latestAuction)
    return (
      <DashboardStat
        label="Reveal Due"
        value="—"
        sub="no auctions"
        accent="gold"
      />
    );

  const data = parseAuction(latestAuction as unknown[], latestAuctionId ?? 0);
  if (!data)
    return (
      <DashboardStat
        label="Reveal Due"
        value="—"
        sub="no auctions"
        accent="gold"
      />
    );

  const remaining = data.biddingEnd > now ? data.biddingEnd - now : 0n;
  const hours = Number(remaining) / 3600;
  const display =
    remaining > 0n
      ? `${Math.floor(hours)}h ${Math.floor((Number(remaining) % 3600) / 60)}m`
      : "Ended";

  return (
    <DashboardStat
      label="Reveal Due"
      value={display}
      sub={remaining > 0n ? "until bidding ends" : "bidding concluded"}
      accent="gold"
    />
  );
}

function FeaturedAuction({
  totalAuctions,
  isLoading: isLoadingCounter,
}: {
  totalAuctions: number;
  isLoading?: boolean;
}) {
  const latestAuctionId = totalAuctions > 0 ? totalAuctions - 1 : null;
  const { data: auction, isLoading } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: latestAuctionId !== null ? [BigInt(latestAuctionId)] : undefined,
    query: { enabled: latestAuctionId !== null },
  });

  const { data: bidCount, isLoading: isLoadingBidCount } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "getBidderCount",
    args: latestAuctionId !== null ? [BigInt(latestAuctionId)] : undefined,
    query: { enabled: latestAuctionId !== null },
  });

  if (isLoadingCounter) {
    return (
      <div className="sb-featured-card">
        <div className="sb-skeleton__bar sb-skeleton__bar--lg" />
      </div>
    );
  }

  if (totalAuctions === 0) {
    return (
      <div className="sb-featured-card">
        <div className="sb-featured-card__badge">No Auctions</div>
        <p className="sb-featured-card__title">No active auctions yet</p>
        <Link to="/create" className="btn-primary">
          <Plus size={16} /> Create First Auction
        </Link>
      </div>
    );
  }

  if (isLoading || !auction)
    return (
      <div className="sb-featured-card">
        <div className="sb-skeleton__bar sb-skeleton__bar--lg" />
      </div>
    );

  const bidders = isLoadingBidCount ? undefined : Number(bidCount || 0);
  const data = parseAuction(
    auction as unknown[],
    latestAuctionId ?? 0,
    bidders ?? 0,
  );
  if (!data)
    return (
      <div className="sb-featured-card">
        <div className="sb-skeleton__bar sb-skeleton__bar--lg" />
      </div>
    );

  const isActive = data.status === "ACTIVE";

  return (
    <div className="sb-featured-card">
      {data.imageURI && (
        <img
          src={data.imageURI}
          alt={data.title}
          className="sb-featured-card__image"
        />
      )}
      <div className="sb-featured-card__badge">
        <Zap size={12} /> Featured Active Auction
      </div>
      <h3 className="sb-featured-card__title">{data.title}</h3>
      {data.category && (
        <span className="sb-featured-card__category">{data.category}</span>
      )}
      <div className="sb-featured-card__meta">
        <div className="sb-featured-card__meta-row">
          <Lock size={14} className="icon-muted" />
          <span className="sb-featured-card__meta-label">Reserve</span>
          <span>Hidden (encrypted)</span>
        </div>
        <div className="sb-featured-card__meta-row">
          <Users size={14} className="icon-muted" />
          <span className="sb-featured-card__meta-label">Bids</span>
          <span>{bidders === undefined ? "..." : `${bidders} sealed`}</span>
        </div>
        <div className="sb-featured-card__meta-row">
          <Clock size={14} className="icon-muted" />
          <span className="sb-featured-card__meta-label">Ends</span>
          <span>
            {isActive ? (
              <CountdownTimer endTime={data.biddingEnd} compact />
            ) : (
              "Ended"
            )}
          </span>
        </div>
      </div>
      <Link to={`/auction/${data.id}`} className="btn-primary">
        <Gavel size={16} /> Submit Encrypted Bid
      </Link>
    </div>
  );
}

function AuctionPhaseTimeline({
  totalAuctions,
  now,
  isLoading: isLoadingCounter,
}: {
  totalAuctions: number;
  now: bigint;
  isLoading?: boolean;
}) {
  const latestAuctionId = totalAuctions > 0 ? totalAuctions - 1 : null;
  const { data: auction } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: latestAuctionId !== null ? [BigInt(latestAuctionId)] : undefined,
    query: { enabled: latestAuctionId !== null },
  });

  if (isLoadingCounter)
    return (
      <div className="sb-timeline">
        <p className="sb-timeline__title">Loading...</p>
      </div>
    );

  if (!auction)
    return (
      <div className="sb-timeline">
        <p className="sb-timeline__title">No auction data</p>
      </div>
    );

  const data = parseAuction(auction as unknown[], latestAuctionId ?? 0);
  if (!data)
    return (
      <div className="sb-timeline">
        <p className="sb-timeline__title">No auction data</p>
      </div>
    );

  const isCommit = data.status === "ACTIVE";
  const isReveal = data.status === "SETTLEMENT";
  const isSettle = data.status === "FINALIZED";

  const remaining = data.biddingEnd > now ? data.biddingEnd - now : 0n;
  const hours = Number(remaining) / 3600;

  return (
    <div className="sb-timeline">
      <p className="sb-timeline__title">Auction Phase Timeline</p>
      <div className="sb-timeline__phases">
        <div
          className={`sb-timeline__phase ${isCommit ? "sb-timeline__phase--active" : "sb-timeline__phase--done"}`}
        >
          <span className="sb-timeline__phase-dot" />
          <span>Commit</span>
        </div>
        <div
          className={`sb-timeline__line ${!isCommit ? "sb-timeline__line--active" : ""}`}
        />
        <div
          className={`sb-timeline__phase ${isReveal ? "sb-timeline__phase--active" : isSettle ? "sb-timeline__phase--done" : ""}`}
        >
          <span className="sb-timeline__phase-dot" />
          <span>Reveal</span>
        </div>
        <div
          className={`sb-timeline__line ${isSettle ? "sb-timeline__line--active" : ""}`}
        />
        <div
          className={`sb-timeline__phase ${isSettle ? "sb-timeline__phase--active" : ""}`}
        >
          <span className="sb-timeline__phase-dot" />
          <span>Settle</span>
        </div>
      </div>
      <div className="sb-timeline__info">
        <div className="sb-timeline__info-row">
          <Clock size={14} className="icon-muted" />
          <span>
            Deadline:{" "}
            {remaining > 0n
              ? `${Math.floor(hours)}h ${Math.floor((Number(remaining) % 3600) / 60)}m`
              : "Ended"}
          </span>
        </div>
        <div className="sb-timeline__info-row">
          <ShieldCheck size={14} className="icon-muted" />
          <span>
            Your status:{" "}
            {isCommit
              ? "Accepting bids"
              : isReveal
                ? "Awaiting reveal"
                : "Settled"}
          </span>
        </div>
      </div>
    </div>
  );
}

function LiveAuctionsTable({
  totalAuctions,
  now,
  isLoading,
}: {
  totalAuctions: number;
  now: bigint;
  isLoading?: boolean;
}) {
  const displayCount = Math.min(totalAuctions, 5);

  return (
    <div className="sb-dashboard-table-card">
      <div className="sb-dashboard-table-header">
        <span className="sb-dashboard-table-title">
          <Gavel size={14} className="icon-cipher" /> Active Auctions
        </span>
        {totalAuctions > 5 && (
          <Link to="/auctions" className="sb-panel__link">
            View all <ChevronRight size={14} />
          </Link>
        )}
      </div>
      {isLoading ? (
        <div className="sb-table-empty">Loading...</div>
      ) : totalAuctions === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No auctions yet"
          description="Be the first to create a sealed-bid auction on BidFlow."
          action={{ label: "Create Auction", href: "/create" }}
        />
      ) : (
        <table className="sb-dashboard-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phase</th>
              <th>Ends</th>
              <th>Bids</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: displayCount }, (_, i) => (
              <AuctionTableRow
                key={totalAuctions - 1 - i}
                auctionId={totalAuctions - 1 - i}
                now={now}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AuctionTableRow({
  auctionId,
  now,
}: {
  auctionId: number;
  now: bigint;
}) {
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

  if (!auction) {
    return (
      <tr className="sb-table-row--loading">
        <td>
          <div className="sb-skeleton__bar sb-skeleton__bar--sm" />
        </td>
        <td>
          <div className="sb-skeleton__bar sb-skeleton__bar--xs" />
        </td>
        <td>
          <div className="sb-skeleton__bar sb-skeleton__bar--xs" />
        </td>
        <td>
          <div className="sb-skeleton__bar sb-skeleton__bar--xs" />
        </td>
      </tr>
    );
  }

  const bidders = isLoadingBidCount
    ? undefined
    : typeof bidCount === "bigint"
      ? Number(bidCount)
      : 0;
  const data = parseAuction(auction as unknown[], auctionId, bidders ?? 0);
  if (!data) return null;

  const isActive = data.status === "ACTIVE";
  const isSettle = data.status === "FINALIZED";
  const phase = isActive
    ? "Commit"
    : data.status === "SETTLEMENT"
      ? "Reveal"
      : "Settled";
  const remaining = data.biddingEnd > now ? data.biddingEnd - now : 0n;
  const hours = Number(remaining) / 3600;

  return (
    <tr>
      <td>
        <Link to={`/auction/${auctionId}`} className="sb-table-link">
          {data.title}
        </Link>
      </td>
      <td>
        <span
          className={`sb-badge ${isActive ? "sb-badge--active" : isSettle ? "sb-badge--finalized" : "sb-badge--ended-warn"}`}
        >
          {phase}
        </span>
      </td>
      <td>
        {remaining > 0n
          ? `${Math.floor(hours)}h ${Math.floor((Number(remaining) % 3600) / 60)}m`
          : "Done"}
      </td>
      <td>{isLoadingBidCount ? "..." : Number(bidCount || 0)}</td>
    </tr>
  );
}

function MySealedBidStatus({
  totalAuctions,
  address,
  now,
}: {
  totalAuctions: number;
  address: string | undefined;
  now: bigint;
}) {
  if (!address) {
    return (
      <div className="sb-dashboard-table-card">
        <div className="sb-dashboard-table-header">
          <span className="sb-dashboard-table-title">
            <Lock size={14} className="icon-cipher" /> My Sealed Bid Status
          </span>
        </div>
        <EmptyState
          icon={Wallet}
          title="Wallet not connected"
          description="Connect your wallet to track your sealed bids across auctions."
        />
      </div>
    );
  }

  // Show last 3 auctions the user might have bid on
  const recentIds = Array.from(
    { length: Math.min(totalAuctions, 3) },
    (_, i) => totalAuctions - 1 - i,
  );

  return (
    <div className="sb-dashboard-table-card">
      <div className="sb-dashboard-table-header">
        <span className="sb-dashboard-table-title">
          <Lock size={14} className="icon-cipher" /> My Sealed Bid Status
        </span>
        <Link to="/my-bids" className="sb-panel__link">
          View all <ChevronRight size={14} />
        </Link>
      </div>
      <table className="sb-dashboard-table">
        <thead>
          <tr>
            <th>Auction</th>
            <th>Status</th>
            <th>ETA</th>
          </tr>
        </thead>
        <tbody>
          {recentIds.map((id) => (
            <MyBidRow key={id} auctionId={id} address={address} now={now} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MyBidRow({
  auctionId,
  address,
  now,
}: {
  auctionId: number;
  address: string;
  now: bigint;
}) {
  const { data: auction } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: [BigInt(auctionId)],
  });

  const { data: userBid } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "bids",
    args: [BigInt(auctionId), address as `0x${string}`],
  });

  if (!auction) return null;

  const data = parseAuction(auction as unknown[], auctionId);
  if (!data) return null;

  const hasBid = userBid ? (userBid as { exists: boolean }).exists : false;
  const remaining = data.biddingEnd > now ? data.biddingEnd - now : 0n;
  const hours = Number(remaining) / 3600;

  if (!hasBid) return null;

  return (
    <tr>
      <td>
        <Link to={`/auction/${auctionId}`} className="sb-table-link">
          {data.title}
        </Link>
      </td>
      <td>
        <span className="sb-badge sb-badge--active">Sealed</span>
      </td>
      <td>{remaining > 0n ? `${Math.floor(hours)}h` : "Awaiting reveal"}</td>
    </tr>
  );
}

function VerificationFeed({ totalAuctions }: { totalAuctions: number }) {
  // Show recent activity as verification events
  const recentIds = Array.from(
    { length: Math.min(totalAuctions, 4) },
    (_, i) => totalAuctions - 1 - i,
  );

  if (totalAuctions === 0) {
    return (
      <div className="sb-verification-feed">
        <div className="sb-dashboard-table-header">
          <span className="sb-dashboard-table-title">
            <ShieldCheck size={14} className="icon-cipher" /> Verification Feed
          </span>
        </div>
        <div className="sb-table-empty">No verification events yet</div>
      </div>
    );
  }

  return (
    <div className="sb-verification-feed">
      <div className="sb-dashboard-table-header">
        <span className="sb-dashboard-table-title">
          <ShieldCheck size={14} className="icon-cipher" /> Verification Feed
        </span>
      </div>
      {recentIds.map((id) => (
        <VerificationItem key={id} auctionId={id} />
      ))}
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

  if (!auction) return null;

  const data = parseAuction(auction as unknown[], auctionId);
  if (!data) return null;

  return (
    <div className="sb-verification-feed__item">
      <CheckCircle2
        size={14}
        className="sb-verification-feed__icon sb-verification-feed__icon--done"
      />
      <span>Bid commitment recorded — {data.title}</span>
    </div>
  );
}

export default Home;
