import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export function AssetDetailPage() {
  const { id } = useParams();

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-fleet-white">Asset Overview</p>
          <Badge tone="neutral">Pending</Badge>
        </div>
        <p className="text-sm text-fleet-light">Asset ID: {id}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button block>Log</Button>
          <Button variant="ghost" block>
            Export CSV
          </Button>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-fleet-light">Timeline, rules, and due states will be wired in Steps 5-8.</p>
      </Card>
    </section>
  );
}
