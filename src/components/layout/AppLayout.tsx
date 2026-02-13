import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PageContainer } from './PageContainer';
import { BottomNav } from './BottomNav';
import { AppHeader } from './AppHeader';
import { Card } from '../ui/Card';

const desktopTabs = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/assets', label: 'All Assets' },
  { to: '/log', label: 'Log Activity' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/more', label: 'More' },
];

export function AppLayout() {
  const location = useLocation();
  const showHeader = !location.pathname.startsWith('/dashboard');

  return (
    <>
      <PageContainer>
        <div className="lg:grid lg:grid-cols-[228px_minmax(0,1fr)] lg:gap-4">
          <aside className="hidden lg:block">
            <Card className="sticky top-6 space-y-4">
              <div className="border-b border-fleet-mid pb-4">
                <p className="fleet-text-metal text-2xl font-semibold text-fleet-white">FLEET-OPS</p>
                <p className="text-xs text-fleet-light">Command UI</p>
              </div>
              <nav className="space-y-2">
                {desktopTabs.map((tab) => (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className={({ isActive }) =>
                      `tap flex w-full items-center rounded-xl border px-3 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'border-fleet-red bg-fleet-red/20 text-fleet-white'
                          : 'fleet-panel-subtle border-fleet-mid text-fleet-light hover:border-fleet-red/50 hover:text-fleet-white'
                      }`
                    }
                  >
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            </Card>
          </aside>

          <div className="min-w-0">
            {showHeader ? <AppHeader /> : null}
            <section className={`${showHeader ? 'mt-6' : ''} space-y-4`}>
              <Outlet />
            </section>
          </div>
        </div>
      </PageContainer>
      <BottomNav />
    </>
  );
}
