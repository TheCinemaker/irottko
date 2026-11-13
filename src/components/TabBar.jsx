import { NavLink, useLocation } from 'react-router-dom';
import { House, Music2, Martini, Ticket } from 'lucide-react';

/*
  Phone navigation, like a native app: four tabs pinned to the bottom,
  above the home indicator. Desktop keeps the top navigation.
*/
const TABS = [
  { to: '/', label: 'Kezdőlap', icon: House, match: (p) => p === '/' },
  { to: '/lineup', label: 'Line-up', icon: Music2, match: (p) => p.startsWith('/lineup') },
  { to: '/barok', label: 'Bárok', icon: Martini, match: (p) => p.startsWith('/barok') || p.startsWith('/vip') },
  { to: '/jegyek', label: 'Check-in', icon: Ticket, match: (p) => p.startsWith('/jegyek') || p.startsWith('/success') },
];

export default function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Fő navigáció"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#05030a]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid h-[58px] max-w-md grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to}>
              <NavLink
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-wide transition-colors active:scale-95 ${
                  active ? 'text-[#d4af37]' : 'text-gray-500'
                }`}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
