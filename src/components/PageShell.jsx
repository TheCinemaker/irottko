import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

// Common page frame: nav, content, footer.
export default function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-[#05030a] text-[#f5f5f7] selection:bg-[#d4af37] selection:text-black">
      <Navbar />
      <main>{children}</main>
      <Footer />
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
