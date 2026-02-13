import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type RuleStatus = 'overdue' | 'due_soon' | 'ok' | 'baseline';

const statusTone: Record<RuleStatus, 'danger' | 'info' | 'neutral'> = {
  overdue: 'danger',
  due_soon: 'info',
  ok: 'neutral',
  baseline: 'info',
};

const statusLabel: Record<RuleStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due Soon',
  ok: 'On Track',
  baseline: 'Set Baseline',
};

export function RuleCard({
  triggerUnit,
  intervalValue,
  lastCompleted,
  status,
  highlighted = false,
  onEdit,
}: {
  triggerUnit: string;
  intervalValue: number;
  lastCompleted: string;
  status: RuleStatus;
  highlighted?: boolean;
  onEdit?: () => void;
}) {
  return (
    <Card className={`space-y-3 ${highlighted ? 'border-fleet-red ring-1 ring-fleet-red/50' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fleet-white">{intervalValue} {triggerUnit} interval</p>
        <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
      </div>
      <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
        <p className="text-xs text-fleet-mid">Last completed</p>
        <p className="text-sm text-fleet-light">{lastCompleted}</p>
      </div>
      <Button variant="ghost" block onClick={onEdit}>
        Edit Rule
      </Button>
    </Card>
  );
}
