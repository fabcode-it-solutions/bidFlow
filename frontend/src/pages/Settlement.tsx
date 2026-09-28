import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useReadContract, useAccount } from "wagmi";
import { motion } from "framer-motion";
import {
  Banknote,
  ChevronRight,
  Wallet,
  Gavel,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { EmptyState } from "../components";
import { BidFlow_ADDRESS, BidFlow_ABI } from "../constants/contracts";
import { parseAuction } from "../utils/auction";
import { formatEth, shortAddr } from "../utils/format";

export function Settlement() {
  const { address } = useAccount();

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
        <Banknote size={24} className="icon-cipher" />
        <div>
          <h1 className="sb-page-new__title">Settlement</h1>
          <p className="sb-page-new__sub">
            Claim payments and refunds from concluded auctions
          </p>
        </div>
      </motion.div>

      {!address ? (
        <EmptyState
          icon={Wallet}
          title="Wallet not connected"
          description="Connect your wallet to check settlement status and claim payments."
        />
      ) : isLoadingCounter ? (
        <div className="sb-table-empty">Loading...</div>
      ) : totalAuctions === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No auctions yet"
          description="Settled auctions will appear here once winners are revealed."
        />
      ) : (
        <div className="sb-dashboard-table-card">
          <div className="sb-table-scroll">
            <table className="sb-dashboard-table">
              <thead>
                <tr>
                  <th>Auction</th>
                  <th>Winner</th>
                  <th>Winning Bid</th>
                  <th>Payment Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {auctionIds.map((id) => (
                  <SettlementRow key={id} auctionId={id} address={address} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SettlementRow({
  auctionId,
  address,
}: {
  auctionId: number;
  address: string;
}) {
  const { data: auction } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: [BigInt(auctionId)],
  });

  const { data: paymentClaimed, isLoading: isLoadingClaimed } = useReadContract(
    {
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "isPaymentClaimed",
      args: [BigInt(auctionId)],
    },
  );

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
      </tr>
    );

  const data = parseAuction(auction as unknown[], auctionId);
  if (!data) return null;

  // Only show settled auctions
  if (data.status !== "FINALIZED") return null;

  const isWinner = data.revealedWinner.toLowerCase() === address.toLowerCase();
  const isSeller = data.seller.toLowerCase() === address.toLowerCase();
  const claimed = isLoadingClaimed ? undefined : paymentClaimed === true;

  return (
    <tr>
      <td>
        <Link to={`/auction/${auctionId}`} className="sb-table-link">
          {data.title}
        </Link>
      </td>
      <td className="sb-td--mono sb-td--muted">
        {shortAddr(data.revealedWinner)}
      </td>
      <td className="sb-td--mono sb-td--accent">
        {formatEth(data.revealedBid)} ETH
      </td>
      <td>
        {isLoadingClaimed ? (
          <span className="sb-td--mono sb-td--muted">...</span>
        ) : claimed ? (
          <span className="sb-td--mono sb-td--success sb-status-inline">
            <CheckCircle2 size={14} /> Claimed
          </span>
        ) : isWinner || isSeller ? (
          <span className="sb-td--mono sb-td--warning sb-status-inline">
            <Clock size={14} /> Claimable
          </span>
        ) : (
          <span className="sb-td--mono sb-td--muted">—</span>
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

export default Settlement;
