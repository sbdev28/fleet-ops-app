import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

export function DashboardPage() {
  const isLoading = false;

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </>
          ) : (
            <>
              <div className="rounded-xl border border-fleet-mid bg-fleet-black p-3">
                <p className="text-xs text-fleet-mid">Overdue</p>
                <p className="text-lg font-semibold text-fleet-white">0</p>
              </div>
              <div className="rounded-xl border border-fleet-mid bg-fleet-black p-3">
                <p className="text-xs text-fleet-mid">Due Soon</p>
                <p className="text-lg font-semibold text-fleet-white">0</p>
              </div>
              <div className="rounded-xl border border-fleet-mid bg-fleet-black p-3">
                <p className="text-xs text-fleet-mid">Assets</p>
                <p className="text-lg font-semibold text-fleet-white">0</p>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-lg font-semibold text-fleet-white">Quick Actions</p>
        <div className="grid grid-cols-3 gap-3">
          <Button className="text-xs" block>
            Log Usage
          </Button>
          <Button className="text-xs" variant="ghost" block>
            Add Service
          </Button>
          <Button className="text-xs" variant="ghost" block>
            Downtime
          </Button>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-fleet-light">No recent activity yet. Add your first asset and log to populate the command feed.</p>
      </Card>
    </section>
  );
}
