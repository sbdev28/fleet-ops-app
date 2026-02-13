import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type AssetStatus = 'overdue' | 'due_soon' | 'ok';

const statusTone: Record<AssetStatus, 'danger' | 'info' | 'neutral'> = {
  overdue: 'danger',
  due_soon: 'info',
  ok: 'neutral',
};

const statusLabel: Record<AssetStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due Soon',
  ok: 'On Track',
};

export function AssetDetailHeaderCard({
  name,
  identifier,
  status,
  currentUsage,
  usageUnit,
  isExporting = false,
  onLog,
  onExport,
}: {
  name: string;
  identifier?: string;
  status: AssetStatus;
  currentUsage: number;
  usageUnit: string;
  isExporting?: boolean;
  onLog?: () => void;
  onExport?: () => void;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="fleet-text-metal truncate text-xl font-semibold text-fleet-white">{name}</p>
          <p className="truncate text-xs tracking-wide text-fleet-mid">{identifier || 'No identifier set'}</p>
        </div>
        <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
      </div>

      <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
        <p className="text-xs text-fleet-mid">Current Usage</p>
        <p className="text-sm font-semibold text-fleet-white">
          {currentUsage} {usageUnit}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button block onClick={onLog}>
          Add Log
        </Button>
        <Button block variant="ghost" onClick={onExport} disabled={isExporting}>
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>
    </Card>
  );
}
