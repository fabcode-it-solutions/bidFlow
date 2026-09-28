import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DashboardLayout, BackToTop, ErrorBoundary, OnboardingModal } from './components';

const Home = lazy(() => import('./pages/Home'));
const CreateAuction = lazy(() => import('./pages/CreateAuction'));
const AuctionDetail = lazy(() => import('./pages/AuctionDetail'));
const ActiveAuctions = lazy(() => import('./pages/ActiveAuctions'));
const MyBids = lazy(() => import('./pages/MyBids'));
const RevealCenter = lazy(() => import('./pages/RevealCenter'));
const Settlement = lazy(() => import('./pages/Settlement'));
const Verification = lazy(() => import('./pages/Verification'));
const Demo = lazy(() => import('./pages/Demo'));
const Docs = lazy(() => import('./pages/Docs'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--t3)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
      Loading...
    </div>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<PageWrapper><Suspense fallback={<PageLoader />}><Home /></Suspense></PageWrapper>} />
          <Route path="/auctions" element={<PageWrapper><Suspense fallback={<PageLoader />}><ActiveAuctions /></Suspense></PageWrapper>} />
          <Route path="/create" element={<PageWrapper><Suspense fallback={<PageLoader />}><CreateAuction /></Suspense></PageWrapper>} />
          <Route path="/auction/:id" element={<PageWrapper><Suspense fallback={<PageLoader />}><AuctionDetail /></Suspense></PageWrapper>} />
          <Route path="/my-bids" element={<PageWrapper><Suspense fallback={<PageLoader />}><MyBids /></Suspense></PageWrapper>} />
          <Route path="/reveal" element={<PageWrapper><Suspense fallback={<PageLoader />}><RevealCenter /></Suspense></PageWrapper>} />
          <Route path="/settlement" element={<PageWrapper><Suspense fallback={<PageLoader />}><Settlement /></Suspense></PageWrapper>} />
          <Route path="/verification" element={<PageWrapper><Suspense fallback={<PageLoader />}><Verification /></Suspense></PageWrapper>} />
          <Route path="/docs" element={<PageWrapper><Suspense fallback={<PageLoader />}><Docs /></Suspense></PageWrapper>} />
        </Route>
        <Route path="/demo" element={<PageWrapper><Suspense fallback={<PageLoader />}><Demo /></Suspense></PageWrapper>} />
        <Route path="*" element={<PageWrapper><Suspense fallback={<PageLoader />}><NotFound /></Suspense></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--gold)] focus:text-[var(--bg-void)] focus:rounded">
        Skip to main content
      </a>
      <ScrollToTop />
      <AnimatedRoutes />
      <BackToTop />
      <OnboardingModal />
    </ErrorBoundary>
  );
}

export default App;
