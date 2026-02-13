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
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-fleet-mid bg-fleet-dark/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <ul className="mx-auto grid w-full max-w-md grid-cols-5 gap-2">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `tap-lg flex items-center justify-center rounded-xl border text-xs font-semibold tracking-wide ${
                  isActive
                    ? 'border-fleet-red bg-fleet-red text-fleet-white shadow-sm'
                    : 'border-fleet-mid bg-fleet-black text-fleet-light'
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
