import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Wallet, ChevronDown, Menu, X } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { BidFlow_ADDRESS, BidFlow_ABI } from "../constants/contracts";
import { parseAuction } from "../utils/auction";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { address } = useAccount();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: walletBalance, isLoading: isBalanceLoading } = useBalance({
    address,
    query: { enabled: !!address },
  });

  const { data: auctionCounter } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctionCounter",
  });

  const totalAuctions = auctionCounter ? Number(auctionCounter) : 0;

  // Build list of auction IDs
  const auctionIds = useMemo(
    () =>
      Array.from(
        { length: Math.min(totalAuctions, 50) },
        (_, i) => totalAuctions - 1 - i,
      ),
    [totalAuctions],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: number) => {
    setQuery("");
    setIsFocused(false);
    navigate(`/auction/${id}`);
  };

  const showDropdown = isFocused && query.length > 0;

  return (
    <header className="sb-topbar">
      {/* Hamburger (mobile only) */}
      {onMenuClick && (
        <button
          className="sb-topbar__menu"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Search */}
      <div className="sb-topbar__search" ref={searchRef}>
        <Search size={15} className="sb-topbar__search-icon" />
        <input
          type="text"
          placeholder="Search auctions..."
          className="sb-topbar__search-input"
          aria-label="Search auctions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
        />
        {query && (
          <button
            className="sb-topbar__search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="sb-topbar__search-results"
            >
              {auctionIds.length === 0 ? (
                <div className="sb-topbar__search-empty">No auctions yet</div>
              ) : (
                <SearchResults
                  ids={auctionIds}
                  query={query}
                  onSelect={handleSelect}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right section */}
      <div className="sb-topbar__right">
        {/* Network badge */}
        <div className="sb-topbar__network">
          <span className="sb-topbar__network-dot" />
          <span className="sb-topbar__network-label">Arbitrum Sepolia</span>
        </div>

        {/* Wallet */}
        <ConnectButton.Custom>
          {({
            account,
            chain,
            mounted,
            openAccountModal,
            openChainModal,
            openConnectModal,
          }) => {
            const ready = mounted;
            const connected = ready && account && chain;
            const wrongNetwork = connected && chain.unsupported;
            const balance = isBalanceLoading
              ? "Loading"
              : walletBalance
                ? `${(Number(walletBalance.formatted) || 0).toFixed(4)} ${walletBalance.symbol}`
                : account?.displayBalance;

            if (!connected) {
              return (
                <button
                  className="sb-topbar__wallet"
                  onClick={openConnectModal}
                  type="button"
                >
                  <Wallet size={15} />
                  <span>Connect</span>
                </button>
              );
            }

            if (wrongNetwork) {
              return (
                <button
                  className="sb-topbar__wallet sb-topbar__wallet--warning"
                  onClick={openChainModal}
                  type="button"
                >
                  <span className="sb-topbar__wallet-dot" />
                  <span>Switch Network</span>
                </button>
              );
            }

            return (
              <button
                className="sb-topbar__wallet sb-topbar__wallet--connected"
                onClick={openAccountModal}
                type="button"
              >
                <span className="sb-topbar__wallet-dot" />
                <div className="sb-topbar__wallet-info">
                  <span className="sb-topbar__wallet-addr">
                    {account.displayName}
                  </span>
                  {balance && (
                    <span className="sb-topbar__wallet-bal">{balance}</span>
                  )}
                </div>
                <ChevronDown size={14} />
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}

// Search results component - fetches each auction and filters by title
function SearchResults({
  ids,
  query,
  onSelect,
}: {
  ids: number[];
  query: string;
  onSelect: (id: number) => void;
}) {
  return (
    <>
      {ids.map((id) => (
        <SearchResultRow key={id} id={id} query={query} onSelect={onSelect} />
      ))}
    </>
  );
}

function SearchResultRow({
  id,
  query,
  onSelect,
}: {
  id: number;
  query: string;
  onSelect: (id: number) => void;
}) {
  const { data: auction } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: [BigInt(id)],
  });

  if (!auction) return null;

  const data = parseAuction(auction as unknown[], id);
  if (!data) return null;

  const matchesQuery = data.title.toLowerCase().includes(query.toLowerCase());
  if (!matchesQuery) return null;

  return (
    <button className="sb-topbar__search-item" onClick={() => onSelect(id)}>
      <span className="sb-topbar__search-item-title">{data.title}</span>
      <span className="sb-topbar__search-item-id">#{id}</span>
    </button>
  );
}
