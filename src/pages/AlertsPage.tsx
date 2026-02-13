import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export function AlertsPage() {
  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-fleet-white">Overdue</p>
          <Badge tone="danger">0 items</Badge>
        </div>
        <p className="text-sm text-fleet-light">No overdue rules at this time.</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-fleet-white">Due Soon</p>
          <Badge tone="neutral">0 items</Badge>
        </div>
        <p className="text-sm text-fleet-light">Rules due-soon feed will activate once maintenance rules are configured.</p>
      </Card>
    </section>
  );
}
