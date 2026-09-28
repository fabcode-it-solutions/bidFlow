import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Gavel,
  FileKey,
  Eye,
  Banknote,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { BidFlow_ADDRESS } from "../constants/contracts";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Auctions", href: "/auctions", icon: Gavel },
  { label: "My Bids", href: "/my-bids", icon: FileKey },
  { label: "Reveal Center", href: "/reveal", icon: Eye },
  { label: "Settlement", href: "/settlement", icon: Banknote },
  { label: "Verification", href: "/verification", icon: ShieldCheck },
  { label: "Docs", href: "/docs", icon: BookOpen },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  const isActive = (href: string) =>
    href === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(href);

  return (
    <aside className={`sb-sidebar ${collapsed ? "sb-sidebar--collapsed" : ""}`}>
      {/* Brand */}
      <div className="sb-sidebar__brand">
        <Link to="/" className="sb-sidebar__logo">
          <img
            src="/BidFlow.png"
            alt="BidFlow"
            className="sb-sidebar__logo-img"
          />
          {!collapsed && (
            <div className="sb-sidebar__logo-text">
              <span className="sb-sidebar__logo-name">
                SHADOW<span className="sb-sidebar__logo-accent">BID</span>
              </span>
              <span className="sb-sidebar__logo-tag">FHE PROTOCOL</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sb-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`sb-sidebar__link ${isActive(item.href) ? "sb-sidebar__link--active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="sb-sidebar__link-icon" />
              {!collapsed && (
                <span className="sb-sidebar__link-label">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="sb-sidebar__bottom">
        <a
          href={`https://sepolia.arbiscan.io/address/${BidFlow_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="sb-sidebar__ext"
          title={collapsed ? "View Contract" : undefined}
        >
          <ExternalLink size={14} />
          {!collapsed && <span>View Contract</span>}
        </a>

        <button
          className="sb-sidebar__toggle"
          onClick={onToggle}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
