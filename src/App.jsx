import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import LineupPage from './pages/LineupPage';
import BarsPage from './pages/BarsPage';
import BarPage from './pages/BarPage';
import VipPage from './pages/VipPage';
import TicketsPage from './pages/TicketsPage';
import TicketSuccess from './pages/TicketSuccess';
import TicketScanner from './pages/TicketScanner';
import TicketAdmin from './pages/TicketAdmin';

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lineup" element={<LineupPage />} />
        <Route path="/barok" element={<BarsPage />} />
        <Route path="/barok/:slug" element={<BarPage />} />
        <Route path="/vip" element={<VipPage />} />
        <Route path="/jegyek" element={<TicketsPage />} />

        {/* staff / post-purchase — not linked from the public site */}
        <Route path="/success" element={<TicketSuccess />} />
        <Route path="/ticket/:id" element={<TicketSuccess />} />
        <Route path="/scan" element={<TicketScanner />} />
        <Route path="/admin" element={<TicketAdmin />} />

        <Route path="*" element={<HomePage />} />
      </Routes>
    </>
  );
}
