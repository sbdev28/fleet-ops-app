import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function EmptyStateCard({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="space-y-3">
      <p className="fleet-text-metal text-lg font-semibold text-fleet-white">{title}</p>
      <p className="text-sm text-fleet-light">{message}</p>
      {actionLabel ? (
        <Button block onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}
