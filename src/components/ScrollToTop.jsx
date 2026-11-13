import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Reset scroll to top whenever the route changes (SPA navigation).
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
