import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useReadContract, useAccount } from "wagmi";
import { motion } from "framer-motion";
import { FileKey, ChevronRight, Wallet, Gavel } from "lucide-react";
import { CountdownTimer, EmptyState } from "../components";
import { BidFlow_ADDRESS, BidFlow_ABI } from "../constants/contracts";
import { parseAuction } from "../utils/auction";
import { useCurrentTimestamp } from "../hooks/useCurrentTimestamp";

export function MyBids() {
  const { address } = useAccount();
  const now = useCurrentTimestamp();

  const { data: auctionCounter, isLoading: isLoadingCounter } = useReadContract(
    {
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "auctionCounter",
    },
  );

  const totalAuctions = auctionCounter ? Number(auctionCounter) : 0;
  const auctionIds = useMemo(
    () => Array.from({ length: totalAuctions }, (_, i) => i),
    [totalAuctions],
  );

  return (
    <div className="sb-page-new">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sb-page-new__header"
      >
        <FileKey size={24} className="icon-cipher" />
        <div>
          <h1 className="sb-page-new__title">My Bids</h1>
          <p className="sb-page-new__sub">
            Track your sealed bids across all auctions
          </p>
        </div>
      </motion.div>

      {!address ? (
        <EmptyState
          icon={Wallet}
          title="Wallet not connected"
          description="Connect your wallet to track your sealed bids across auctions."
        />
      ) : isLoadingCounter ? (
        <div className="sb-table-empty">Loading...</div>
      ) : totalAuctions === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No auctions yet"
          description="Be the first to create a sealed-bid auction on BidFlow."
          action={{ label: "Create Auction", href: "/create" }}
        />
      ) : (
        <div className="sb-dashboard-table-card">
          <div className="sb-table-scroll">
            <table className="sb-dashboard-table">
              <thead>
                <tr>
                  <th>Auction</th>
                  <th>Status</th>
                  <th>My Bid</th>
                  <th>Phase</th>
                  <th>Ends</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {auctionIds.map((id) => (
                  <MyBidRow
                    key={id}
                    auctionId={id}
                    address={address}
                    now={now}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

  if (!auction)
    return (
      <tr className="sb-table-row--loading">
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
      </tr>
    );

  const data = parseAuction(auction as unknown[], auctionId);
  if (!data) return null;

  const hasBid = userBid ? (userBid as { exists: boolean }).exists : false;

  if (!hasBid) return null;

  const phase =
    data.status === "ACTIVE"
      ? "Commit"
      : data.status === "SETTLEMENT"
        ? "Reveal"
        : "Settled";
  const remaining = data.biddingEnd > now ? data.biddingEnd - now : 0n;

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
      <td className="sb-td--mono sb-td--muted">Hidden (encrypted)</td>
      <td>
        <span
          className={`sb-badge ${data.status === "ACTIVE" ? "sb-badge--active" : data.status === "FINALIZED" ? "sb-badge--finalized" : "sb-badge--ended-warn"}`}
        >
          {phase}
        </span>
      </td>
      <td>
        {remaining > 0n ? (
          <CountdownTimer endTime={data.biddingEnd} compact />
        ) : (
          "Ended"
        )}
      </td>
      <td>
        <Link
          to={`/auction/${auctionId}`}
          className="sb-table-link"
          style={{ color: "var(--text-muted)" }}
          aria-label={`View auction ${data.title}`}
        >
          <ChevronRight size={16} />
        </Link>
      </td>
    </tr>
  );
}

export default MyBids;
