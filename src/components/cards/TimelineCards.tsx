import { Card } from '../ui/Card';

export type TimelineItem = {
  id: string;
  type: 'usage' | 'maintenance' | 'downtime';
  dateLabel: string;
  summary: string;
};

export function TimelineCards({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-fleet-light">No timeline events yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id} className="relative overflow-hidden">
          <div className="absolute bottom-4 left-4 top-4 w-0.5 rounded-full bg-fleet-mid" />
          <div className="space-y-1 pl-4">
            <p className="text-xs uppercase tracking-wide text-fleet-mid">{item.type}</p>
            <p className="text-sm font-semibold text-fleet-white">{item.summary}</p>
            <p className="text-xs text-fleet-light">{item.dateLabel}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
