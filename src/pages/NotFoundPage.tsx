import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/layout/PageContainer';

export function NotFoundPage() {
  return (
    <PageContainer>
      <div className="mx-auto mt-12 max-w-md space-y-4">
        <div className="space-y-1">
          <p className="text-xs tracking-[0.2em] text-fleet-mid">NAVIGATION</p>
          <h1 className="fleet-text-metal text-xl font-semibold text-fleet-white">Page Not Found</h1>
        </div>
        <Card className="space-y-3">
          <p className="text-sm text-fleet-light">The route you requested does not exist.</p>
          <Link to="/dashboard" className="block">
            <Button block>Return to Dashboard</Button>
          </Link>
        </Card>
      </div>
    </PageContainer>
  );
}
