import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import LineupPage from './pages/LineupPage';
import BarsPage from './pages/BarsPage';
import BarPage from './pages/BarPage';
import VipPage from './pages/VipPage';
import TicketsPage from './pages/TicketsPage';
// Loaded on demand: staff tools (QR scanner, admin), post-purchase page (QR codes)
// and the long legal texts are not needed by the landing page.
const TicketSuccess = lazy(() => import('./pages/TicketSuccess'));
const TicketScanner = lazy(() => import('./pages/TicketScanner'));
const TicketAdmin = lazy(() => import('./pages/TicketAdmin'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage')); // "Gate not found"
const FidsPage = lazy(() => import('./pages/FidsPage')); // TV departures board for the venue
const TermsPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPage })));
const ImprintPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.ImprintPage })));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="min-h-screen bg-[#05030a]" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lineup" element={<LineupPage />} />
        <Route path="/barok" element={<BarsPage />} />
        <Route path="/barok/:slug" element={<BarPage />} />
        <Route path="/vip" element={<VipPage />} />
        <Route path="/jegyek" element={<TicketsPage />} />

        {/* staff / post-purchase — not linked from the public site */}
        <Route path="/aszf" element={<TermsPage />} />
        <Route path="/adatkezeles" element={<PrivacyPage />} />
        <Route path="/impresszum" element={<ImprintPage />} />
        <Route path="/success" element={<TicketSuccess />} />
        <Route path="/scan" element={<TicketScanner />} />
        <Route path="/admin" element={<TicketAdmin />} />
        <Route path="/kijelzo" element={<FidsPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </>
  );
}
