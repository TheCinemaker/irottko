import React from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import TabBar from './TabBar';

// Common page frame: top bar, content (fades in on every route change),
// footer, and the bottom tab bar on phones (its height is kept free).
// Marks <html class="kb-open"> while a text field has focus (= keyboard up on phones).
function useKeyboardOpen() {
  useEffect(() => {
    const typing = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit)$/.test(el.type)));
    let t;
    const onIn = (e) => typing(e.target) && (clearTimeout(t), document.documentElement.classList.add('kb-open'));
    // small delay: moving focus from one field to the next must not flicker the bars
    const onOut = () => (t = setTimeout(() => !typing(document.activeElement) && document.documentElement.classList.remove('kb-open'), 120));
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
      document.documentElement.classList.remove('kb-open');
    };
  }, []);
}

export default function PageShell({ children }) {
  const { pathname } = useLocation();
  useKeyboardOpen();
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
export function PageHeader({ kicker, title, children, compact = false }) {
  return (
    <header className={`mx-auto max-w-4xl px-5 pb-14 text-center sm:pb-20 ${compact ? 'pt-14' : 'pt-32 sm:pt-40'}`}>
      {kicker && <div className="kicker">{kicker}</div>}
      <h1 className="display mt-4 text-5xl sm:text-7xl">{title}</h1>
      {children && <p className="mx-auto mt-5 max-w-xl text-lg text-gray-400 sm:text-xl">{children}</p>}
    </header>
  );
}
