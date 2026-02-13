import { Card } from '../components/ui/Card';

export function AlertsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-fleet-white">Alerts</h1>
      <Card>
        <p className="text-sm text-fleet-light">Overdue and due-soon alerts will be added in Step 7.</p>
      </Card>
    </section>
  );
}
