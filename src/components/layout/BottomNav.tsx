import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/assets', label: 'Assets' },
  { to: '/log', label: 'Log' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/more', label: 'More' },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-fleet-mid/80 bg-fleet-black/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      <ul className="mx-auto grid w-full max-w-md grid-cols-5 gap-2">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `tap-lg fleet-panel-subtle flex items-center justify-center rounded-xl border text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'border-fleet-red bg-gradient-to-b from-fleet-red to-fleet-redHover text-fleet-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_16px_rgba(153,27,27,0.3)]'
                    : 'border-fleet-mid text-fleet-light'
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
