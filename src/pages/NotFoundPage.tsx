import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <main className="min-h-screen bg-fleet-black px-4 pt-6 pb-24 text-fleet-white">
      <div className="mx-auto mt-12 max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-fleet-white">Page Not Found</h1>
        <Card className="space-y-3">
          <p className="text-sm text-fleet-light">The route you requested does not exist.</p>
          <Link to="/dashboard" className="block">
            <Button block>Return to Dashboard</Button>
          </Link>
        </Card>
      </div>
    </main>
  );
}
