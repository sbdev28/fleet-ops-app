import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="space-y-3 border-fleet-danger/80">
      <p className="fleet-text-metal text-lg font-semibold text-fleet-white">Error</p>
      <p className="text-sm text-fleet-light">{message}</p>
      {onRetry ? (
        <Button block onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </Card>
  );
}
