import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useReadContract } from "wagmi";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Clock,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { CountdownTimer } from "../components";
import { BidFlow_ABI, BidFlow_ADDRESS } from "../constants/contracts";
import { parseAuction } from "../utils/auction";

export function ActiveAuctions() {
  const [searchQuery, setSearchQuery] = useState("");

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
      Array.from(
        { length: totalAuctions },
        (_, index) => totalAuctions - 1 - index,
      ),
    [totalAuctions],
  );

  return (
    <div className="sb-active-page">
      <section className="sb-active-hero">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="sb-active-hero__copy"
        >
          <div className="sb-active-kicker">
            <ShieldCheck size={16} /> Encrypted sealed-bid market
          </div>
          <h1>Active Auctions</h1>
          <p>
            Browse sealed auctions, deposit ETH, and submit encrypted bids
            before the bidding window closes.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="sb-active-hero__panel"
        >
          <span>Total auctions</span>
          <strong>{isLoadingCounter ? "..." : totalAuctions}</strong>
          <Link to="/create" className="btn-primary sb-active-hero__cta">
            <Plus size={18} /> Create Auction
          </Link>
        </motion.div>
      </section>

      <section className="sb-active-toolbar">
        <div>
          <h2>Open sealed auctions</h2>
          <p>Only auctions still accepting encrypted bids are shown here.</p>
        </div>
        <div className="sb-search sb-active-search">
          <Search size={16} className="icon-muted" />
          <input
            type="text"
            placeholder="Search active auctions..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="sb-search__input"
            aria-label="Search active auctions"
          />
        </div>
      </section>

      <div className="sb-active-list">
        {isLoadingCounter ? (
          <div className="sb-table-empty">Loading...</div>
        ) : totalAuctions === 0 ? (
          <ActiveEmptyState />
        ) : (
          auctionIds.map((auctionId, index) => (
            <ActiveAuctionRow
              key={auctionId}
              auctionId={auctionId}
              searchQuery={searchQuery}
              index={index}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ActiveEmptyState() {
  return (
    <div className="sb-active-empty">
      <div className="sb-active-empty__icon">
        <Sparkles size={30} />
      </div>
      <h3>No active auctions yet</h3>
      <p>
        Create the first encrypted auction and it will appear here while bidding
        is open.
      </p>
      <Link to="/create" className="btn-primary">
        <Plus size={18} /> Create Auction
      </Link>
    </div>
  );
}

function ActiveAuctionRow({
  auctionId,
  searchQuery,
  index,
}: {
  auctionId: number;
  searchQuery: string;
  index: number;
}) {
  const { data: auction, isLoading } = useReadContract({
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

  if (isLoading) return <ActiveAuctionSkeleton />;
  if (!auction || !Array.isArray(auction)) return null;

  const bidders = isLoadingBidCount ? undefined : Number(bidCount || 0);
  const auctionData = parseAuction(auction as unknown[], auctionId, bidders);
  if (!auctionData) return null;

  const isActive = auctionData.status === "ACTIVE";
  const matchesSearch = auctionData.title
    .toLowerCase()
    .includes(searchQuery.trim().toLowerCase());
  if (!isActive || !matchesSearch) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.24) }}
    >
      <Link to={`/auction/${auctionId}`} className="sb-active-row">
        {auctionData.imageURI ? (
          <img
            src={auctionData.imageURI}
            alt={auctionData.title}
            className="sb-active-row__image"
          />
        ) : (
          <div className="sb-active-row__icon">
            <Zap size={20} />
          </div>
        )}
        <div className="sb-active-row__main">
          <div className="sb-active-row__head">
            <h3>{auctionData.title}</h3>
            <span className="sb-badge sb-badge--active">Active</span>
          </div>
          <div className="sb-active-row__meta">
            {auctionData.category && <span>{auctionData.category}</span>}
            <span>
              <Users size={13} /> {auctionData.sealedBidCount} sealed bids
            </span>
            <span>
              <Clock size={13} />{" "}
              <CountdownTimer endTime={auctionData.biddingEnd} compact />
            </span>
          </div>
        </div>
        <ChevronRight size={18} />
      </Link>
    </motion.div>
  );
}

function ActiveAuctionSkeleton() {
  return (
    <div className="sb-active-row sb-active-row--loading">
      <div className="sb-auction-item__skeleton sb-auction-item__skeleton--icon" />
      <div className="sb-auction-item__skeleton-group">
        <div className="sb-auction-item__skeleton sb-auction-item__skeleton--title" />
        <div className="sb-auction-item__skeleton sb-auction-item__skeleton--sub" />
      </div>
    </div>
  );
}

export default ActiveAuctions;
