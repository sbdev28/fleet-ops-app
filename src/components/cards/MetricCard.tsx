import { Card } from '../ui/Card';

type MetricTone = 'default' | 'danger';

export function MetricCard({
  label,
  value,
  subtitle,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: MetricTone;
}) {
  return (
    <Card className="space-y-2">
      <p className="text-xs text-fleet-mid">{label}</p>
      <p className={`text-lg font-semibold ${tone === 'danger' ? 'text-fleet-red' : 'text-fleet-white'}`}>{value}</p>
      {subtitle ? <p className="text-xs text-fleet-light">{subtitle}</p> : null}
    </Card>
  );
}
