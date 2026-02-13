import { Card } from '../components/ui/Card';

export function LogPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-fleet-white">Log</h1>
      <Card>
        <p className="text-sm text-fleet-light">Usage, maintenance, and downtime wizard is next in Step 6.</p>
      </Card>
    </section>
  );
}
