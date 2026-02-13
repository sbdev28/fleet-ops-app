import { useLocation } from 'react-router-dom';
import { Badge } from '../ui/Badge';

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Command overview' },
  '/assets': { title: 'Assets', subtitle: 'Operational inventory' },
  '/log': { title: 'Log', subtitle: 'Record activity' },
  '/alerts': { title: 'Alerts', subtitle: 'Attention queue' },
  '/more': { title: 'More', subtitle: 'Account and settings' },
};

export function AppHeader() {
  const location = useLocation();
  const key = Object.keys(routeTitles).find((path) => location.pathname.startsWith(path));
  const current = key ? routeTitles[key] : { title: 'FleetOps', subtitle: 'Operations console' };

  return (
    <header className="fleet-panel rounded-2xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs tracking-[0.18em] text-fleet-mid">FLEETOPS COMMAND CENTER</p>
          <h1 className="fleet-text-metal text-xl font-semibold text-fleet-white">{current.title}</h1>
          <p className="text-sm text-fleet-light">{current.subtitle}</p>
        </div>
        <Badge tone="info">Ready</Badge>
      </div>
    </header>
  );
}
