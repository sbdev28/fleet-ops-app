import { Card } from '../components/ui/Card';

export function DashboardPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-fleet-white">Dashboard</h1>
      <Card>
        <p className="text-sm text-fleet-light">MVP shell is active. Metrics and activity cards are next in Step 3/4.</p>
      </Card>
    </section>
  );
}
