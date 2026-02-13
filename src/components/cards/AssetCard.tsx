import { Badge } from '../ui/Badge';
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

export function AssetCard({
  name,
  type,
  currentUsage,
  usageUnit,
  status,
  nextDue,
  onOpen,
}: {
  name: string;
  type: string;
  currentUsage: number;
  usageUnit: string;
  status: AssetStatus;
  nextDue: string;
  onOpen?: () => void;
}) {
  const typeCode = type.slice(0, 2).toUpperCase();

  return (
    <Card>
      <button
        type="button"
        className="tap w-full space-y-3 text-left"
        onClick={onOpen}
        disabled={!onOpen}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="fleet-panel-subtle flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-fleet-mid">
              <span className="text-sm font-semibold text-fleet-light">{typeCode}</span>
            </div>
            <p className="text-lg font-semibold text-fleet-white">{name}</p>
            <p className="truncate text-sm text-fleet-light capitalize">{type}</p>
          </div>
          <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
            <p className="text-xs text-fleet-mid">Current Usage</p>
            <p className="text-sm font-semibold text-fleet-white">
              {currentUsage} {usageUnit}
            </p>
          </div>
          <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
            <p className="text-xs text-fleet-mid">Next Due</p>
            <p className="text-sm font-semibold text-fleet-white">{nextDue}</p>
          </div>
        </div>
      </button>
    </Card>
  );
}
