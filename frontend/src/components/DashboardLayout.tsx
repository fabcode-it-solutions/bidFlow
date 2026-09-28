import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ExternalLink } from "lucide-react";

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 769);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 769;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const handleMobileToggle = useCallback(() => {
    setMobileOpen((v) => !v);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleDesktopToggle = useCallback(() => {
    setSidebarCollapsed((v) => !v);
  }, []);

  // Desktop: collapsed = sidebar small (icon only)
  // Mobile: sidebar always hidden unless mobileOpen
  const sidebarCollapsedValue = isMobile ? !mobileOpen : sidebarCollapsed;

  return (
    <div className="sb-dashboard-layout">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          className="sb-sidebar-overlay"
          onClick={handleMobileClose}
          aria-label="Close navigation menu"
          type="button"
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsedValue}
        onToggle={isMobile ? handleMobileToggle : handleDesktopToggle}
      />

      <div
        className={`sb-dashboard-layout__main ${sidebarCollapsedValue ? "sb-dashboard-layout__main--collapsed" : ""}`}
      >
        <Topbar onMenuClick={isMobile ? handleMobileToggle : undefined} />
        <main className="sb-dashboard-layout__content" id="main-content">
          <Outlet />
        </main>
        <footer className="sb-footer">
          <div className="sb-footer__left">
            <span className="sb-footer__brand">BidFlow</span>
            <span className="sb-footer__sep">·</span>
            <span className="sb-footer__wave">Fhenix Wave 5 Buildathon</span>
          </div>
          <div className="sb-footer__right">
            <a
              href="https://BidFlow26.vercel.app/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="sb-footer__link"
            >
              Docs <ExternalLink size={10} />
            </a>
            <a
              href="https://github.com/nohypelabs/BidFlow"
              target="_blank"
              rel="noopener noreferrer"
              className="sb-footer__link"
            >
              GitHub <ExternalLink size={10} />
            </a>
            <a
              href="https://x.com/nohypelabs"
              target="_blank"
              rel="noopener noreferrer"
              className="sb-footer__link"
            >
              X <ExternalLink size={10} />
            </a>
            <a
              href="https://t.me/nohypelabs"
              target="_blank"
              rel="noopener noreferrer"
              className="sb-footer__link"
            >
              Telegram <ExternalLink size={10} />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
