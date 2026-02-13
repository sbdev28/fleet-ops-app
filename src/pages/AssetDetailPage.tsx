import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';

export function AssetDetailPage() {
  const { id } = useParams();

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-fleet-white">Asset Detail</h1>
      <Card>
        <p className="text-sm text-fleet-light">Asset ID: {id}</p>
      </Card>
    </section>
  );
}
