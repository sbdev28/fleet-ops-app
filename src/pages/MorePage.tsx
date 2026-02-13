import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function MorePage() {
  const navigate = useNavigate();
  const { signOut, session } = useAuth();

  const onLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-fleet-white">More</h1>
      <Card className="space-y-3">
        <p className="text-sm text-fleet-light">Signed in as {session?.user.email ?? 'Unknown user'}</p>
        <p className="text-xs text-fleet-mid">Version 0.1.0</p>
        <Button onClick={onLogout} block>
          Logout
        </Button>
      </Card>
    </section>
  );
}
