import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

type Severity = 'overdue' | 'due_soon';

export function AlertCard({
  title,
  detail,
  severity,
  onOpen,
}: {
  title: string;
  detail: string;
  severity: Severity;
  onOpen?: () => void;
}) {
  const tone = severity === 'overdue' ? 'danger' : 'info';
  const label = severity === 'overdue' ? 'Overdue' : 'Due Soon';

  return (
    <Card>
      <button
        type="button"
        className="tap w-full text-left"
        onClick={onOpen}
        disabled={!onOpen}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 h-10 w-1 rounded-full ${
              severity === 'overdue' ? 'bg-fleet-danger' : 'bg-fleet-red'
            }`}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-fleet-white">{title}</p>
              <Badge tone={tone}>{label}</Badge>
            </div>
            <p className="text-sm text-fleet-light">{detail}</p>
          </div>
        </div>
      </button>
    </Card>
  );
}
