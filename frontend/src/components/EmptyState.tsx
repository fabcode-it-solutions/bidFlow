import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { type LucideIcon, Gavel, Wallet, FileKey, Search } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="sb-empty-state"
    >
      <div className="sb-empty-state__icon">
        <Icon size={24} />
      </div>
      <h3 className="sb-empty-state__title">{title}</h3>
      <p className="sb-empty-state__desc">{description}</p>
      {(action || secondaryAction) && (
        <div className="sb-empty-state__actions">
          {action && (
            <Link to={action.href} className="btn-primary">
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link to={secondaryAction.href} className="btn-secondary">
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Preset empty states for common scenarios
export function NoAuctionsEmpty() {
  return (
    <EmptyState
      icon={Gavel}
      title="No auctions yet"
      description="Be the first to create a sealed-bid auction on BidFlow."
      action={{ label: "Create Auction", href: "/create" }}
    />
  );
}

export function NoWalletEmpty({
  message = "Connect your wallet to continue",
}: {
  message?: string;
}) {
  return (
    <EmptyState
      icon={Wallet}
      title="Wallet not connected"
      description={message}
    />
  );
}

export function NoBidsEmpty() {
  return (
    <EmptyState
      icon={FileKey}
      title="No bids yet"
      description="Be the first bidder. Your bid amount stays encrypted until the auction closes."
    />
  );
}

export function NoSearchResultsEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`No auctions match "${query}". Try a different search term.`}
      action={{ label: "View All Auctions", href: "/auctions" }}
    />
  );
}
