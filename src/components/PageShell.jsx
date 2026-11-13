import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import TabBar from './TabBar';

// Common page frame: top bar, content (fades in on every route change),
// footer, and the bottom tab bar on phones (its height is kept free).
export default function PageShell({ children }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-[#05030a] pb-[var(--tabbar)] text-[#f5f5f7] selection:bg-[#d4af37] selection:text-black">
      <Navbar />
      <main key={pathname} className="page-in">
        {children}
      </main>
      <Footer />
      <TabBar />
    </div>
  );
}

// Quiet page header: kicker, one big title, one line of copy.
export function PageHeader({ kicker, title, children }) {
  return (
    <header className="mx-auto max-w-4xl px-5 pt-32 pb-14 text-center sm:pt-40 sm:pb-20">
      {kicker && <div className="kicker">{kicker}</div>}
      <h1 className="display mt-4 text-5xl sm:text-7xl">{title}</h1>
      {children && <p className="mx-auto mt-5 max-w-xl text-lg text-gray-400 sm:text-xl">{children}</p>}
    </header>
  );
}
