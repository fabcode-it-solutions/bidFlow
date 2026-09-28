import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Search } from 'lucide-react';

export function NotFound() {
  return (
    <div className="sb-404">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sb-404__card"
      >
        <div className="sb-404__glow" />

        <div className="sb-404__icon-wrap">
          <Search size={32} className="icon-cipher" />
        </div>

        <h1 className="sb-404__code">404</h1>
        <h2 className="sb-404__title">Page Not Found</h2>
        <p className="sb-404__desc">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="sb-404__actions">
          <Link to="/" className="btn-primary sb-404__btn">
            <Home size={16} />
            Back to Home
          </Link>
          <Link to="/auctions" className="btn-ghost sb-404__btn">
            <Search size={16} />
            Browse Auctions
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default NotFound;
