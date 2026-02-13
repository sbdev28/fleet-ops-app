import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorCard } from '../components/cards/ErrorCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useDashboard } from '../hooks/useDashboard';
import type { AssetType } from '../lib/types';

const typeCode: Record<AssetType, string> = {
  marine: 'MR',
  vehicle: 'VH',
  equipment: 'EQ',
  other: 'OT',
};

function FleetHealthGauge({ score }: { score: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * ((100 - progress) / 100);

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden>
        <circle cx="48" cy="48" r={radius} fill="none" strokeWidth="8" className="stroke-fleet-mid" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-fleet-red transition-all duration-500"
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset: dashOffset,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-semibold leading-none text-fleet-white">{progress}</p>
        <p className="text-xs text-fleet-light">/100</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    overdueCount,
    dueSoonCount,
    totalAssets,
    healthScore,
    assetPreview,
    attention,
    recentActivity,
    isLoading,
    isError,
    errorMessage,
  } = useDashboard();

  const attentionCount = overdueCount + dueSoonCount;
  const nextServiceLabel = attention[0]?.detail || 'No service windows currently due.';

  return (
    <section className="space-y-4">
      {isError ? <ErrorCard message={errorMessage || 'Dashboard feed failed to load.'} /> : null}

      <div className="space-y-4 lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-4 lg:space-y-0">
        <div className="space-y-4">
          <Card className="relative overflow-hidden">
            <div className="absolute right-4 top-4 h-24 w-24 rounded-full border border-fleet-mid bg-fleet-black/45 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-[24px] border border-fleet-mid bg-fleet-black shadow-sm">
                <div className="flex h-20 w-16 flex-col items-center justify-center rounded-[16px] border border-fleet-mid bg-fleet-dark">
                  <p className="text-[10px] tracking-[0.24em] text-fleet-light">FLEET</p>
                  <div className="my-1 h-px w-10 bg-fleet-mid" />
                  <p className="text-sm font-semibold text-fleet-white">OPS</p>
                </div>
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs tracking-[0.2em] text-fleet-mid">OPERATIONS CONSOLE</p>
                <h1 className="fleet-text-metal text-xl font-semibold text-fleet-white">Fleet Command Dashboard</h1>
                <p className="text-sm text-fleet-light">Live readiness and alerts across your active fleet.</p>
              </div>
            </div>
          </Card>

          {isLoading ? (
            <Card className="space-y-3">
              <Skeleton className="h-24" />
            </Card>
          ) : (
            <Card className="relative overflow-hidden">
              <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-fleet-red/15 to-transparent" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-4">
                  <FleetHealthGauge score={healthScore} />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-fleet-white">Fleet Health</p>
                    <p className="text-sm text-fleet-light">{attentionCount} items require attention</p>
                    <p className="text-sm text-fleet-light">{nextServiceLabel}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="fleet-panel-subtle rounded-xl border p-3 text-center">
                    <p className="text-xs text-fleet-mid">Overdue</p>
                    <p className="text-sm font-semibold text-fleet-red">{overdueCount}</p>
                  </div>
                  <div className="fleet-panel-subtle rounded-xl border p-3 text-center">
                    <p className="text-xs text-fleet-mid">Due Soon</p>
                    <p className="text-sm font-semibold text-fleet-white">{dueSoonCount}</p>
                  </div>
                  <div className="fleet-panel-subtle rounded-xl border p-3 text-center">
                    <p className="text-xs text-fleet-mid">Assets</p>
                    <p className="text-sm font-semibold text-fleet-white">{totalAssets}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-fleet-white">Fleet Units</p>
              <Button variant="ghost" className="px-3 text-xs" onClick={() => navigate('/assets')}>
                View All
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : assetPreview.length === 0 ? (
              <p className="text-sm text-fleet-light">No assets yet. Add your first asset to activate dashboard tracking.</p>
            ) : (
              <div className="space-y-3">
                {assetPreview.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className="tap fleet-panel-subtle w-full rounded-xl border p-3 text-left"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="fleet-panel-subtle flex h-14 w-14 items-center justify-center rounded-xl border">
                        <span className="text-sm font-semibold text-fleet-light" aria-hidden>
                          {typeCode[asset.type]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold text-fleet-white">{asset.name}</p>
                        <p className="truncate text-sm text-fleet-light capitalize">
                          {asset.type} • {asset.nextDueLabel}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <Badge tone={asset.status === 'overdue' ? 'danger' : asset.status === 'due_soon' ? 'info' : 'neutral'}>
                          {asset.status === 'overdue' ? 'Overdue' : asset.status === 'due_soon' ? 'Due Soon' : 'On Track'}
                        </Badge>
                        <p className="text-xs text-fleet-mid">{asset.type}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <p className="text-lg font-semibold text-fleet-white">Quick Actions</p>
            <div className="grid grid-cols-3 gap-3">
              <Button className="text-xs" block onClick={() => navigate('/log?type=usage')}>
                Log Usage
              </Button>
              <Button className="text-xs" variant="ghost" block onClick={() => navigate('/log?type=maintenance')}>
                Service
              </Button>
              <Button className="text-xs" variant="ghost" block onClick={() => navigate('/log?type=downtime')}>
                Downtime
              </Button>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-fleet-white">Attention</p>
              <Button variant="ghost" className="px-3 text-xs" onClick={() => navigate('/alerts')}>
                Open Alerts
              </Button>
            </div>

            {attention.length === 0 ? (
              <p className="text-sm text-fleet-light">No alerts active.</p>
            ) : (
              <div className="space-y-3">
                {attention.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    className="tap fleet-panel-subtle w-full rounded-xl border p-3 text-left"
                    onClick={() => navigate(`/assets/${alert.assetId}?ruleId=${alert.ruleId}`)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-fleet-white">{alert.title}</p>
                      <Badge tone={alert.severity === 'overdue' ? 'danger' : 'info'}>
                        {alert.severity === 'overdue' ? 'Overdue' : 'Due Soon'}
                      </Badge>
                    </div>
                    <p className="text-xs text-fleet-light">{alert.detail}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <p className="text-lg font-semibold text-fleet-white">Recent Activity</p>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-fleet-light">Add usage, maintenance, or downtime logs to populate this feed.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/assets/${item.assetId}`)}
                    className="tap fleet-panel-subtle w-full rounded-xl border p-3 text-left"
                  >
                    <p className="text-xs uppercase tracking-wide text-fleet-mid">{item.kind}</p>
                    <p className="text-sm font-semibold text-fleet-white">{item.assetName}</p>
                    <p className="text-sm text-fleet-light">{item.summary}</p>
                    <p className="text-xs text-fleet-mid">{item.dateLabel}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
