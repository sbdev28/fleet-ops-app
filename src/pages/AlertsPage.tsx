import { useNavigate } from 'react-router-dom';
import { AlertCard } from '../components/cards/AlertCard';
import { EmptyStateCard } from '../components/cards/EmptyStateCard';
import { ErrorCard } from '../components/cards/ErrorCard';
import { Skeleton } from '../components/ui/Skeleton';
import { Card } from '../components/ui/Card';
import { useAlerts } from '../hooks/useAlerts';

export function AlertsPage() {
  const navigate = useNavigate();
  const { overdueAlerts, dueSoonAlerts, isLoading, isError, errorMessage } = useAlerts();

  if (isError) {
    return <ErrorCard message={errorMessage || 'Unable to load alerts. Please retry.'} />;
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <Card className="space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-16" />
        </Card>
        <Card className="space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-16" />
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
      <Card className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs tracking-[0.18em] text-fleet-mid">CRITICAL</p>
          <h2 className="fleet-text-metal text-lg font-semibold text-fleet-white">Overdue</h2>
        </div>

        {overdueAlerts.length === 0 ? (
          <EmptyStateCard title="No overdue alerts" message="Critical rule breaches will appear here." />
        ) : (
          <div className="space-y-4">
            {overdueAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                title={alert.title}
                detail={alert.detail}
                severity="overdue"
                onOpen={() => navigate(`/assets/${alert.assetId}?ruleId=${alert.ruleId}`)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs tracking-[0.18em] text-fleet-mid">UPCOMING</p>
          <h2 className="fleet-text-metal text-lg font-semibold text-fleet-white">Due Soon</h2>
        </div>

        {dueSoonAlerts.length === 0 ? (
          <EmptyStateCard
            title="No due-soon alerts"
            message="Upcoming maintenance windows will appear here."
          />
        ) : (
          <div className="space-y-4">
            {dueSoonAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                title={alert.title}
                detail={alert.detail}
                severity="due_soon"
                onOpen={() => navigate(`/assets/${alert.assetId}?ruleId=${alert.ruleId}`)}
              />
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
