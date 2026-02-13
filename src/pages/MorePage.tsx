import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

export function MorePage() {
  const navigate = useNavigate();
  const { signOut, session } = useAuth();
  const { showToast } = useToast();

  const onLogout = async () => {
    await signOut();
    showToast('Signed out', 'info');
    navigate('/login', { replace: true });
  };

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-fleet-white">Profile</p>
          <Badge tone="info">Secure</Badge>
        </div>
        <p className="text-sm text-fleet-light">Signed in as {session?.user.email ?? 'Unknown user'}</p>
        <p className="text-xs text-fleet-mid">Version 0.1.0</p>
        <Button onClick={onLogout} block>
          Logout
        </Button>
      </Card>
    </section>
  );
}
