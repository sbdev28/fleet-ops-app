import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useState } from 'react';

export function MorePage() {
  const navigate = useNavigate();
  const { signOut, session } = useAuth();
  const { showToast } = useToast();
  const [themeMode, setThemeMode] = useState<'dark' | 'deep'>('dark');

  const onLogout = async () => {
    await signOut();
    showToast('Signed out', 'info');
    navigate('/login', { replace: true });
  };

  return (
    <section className="space-y-4 lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:space-y-0">
      <div className="space-y-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs tracking-[0.18em] text-fleet-mid">ACCOUNT</p>
              <p className="fleet-text-metal text-lg font-semibold text-fleet-white">Profile</p>
            </div>
            <Badge tone="info">Secure</Badge>
          </div>
          <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
            <p className="text-xs text-fleet-mid">SIGNED IN USER</p>
            <p className="text-sm text-fleet-light">{session?.user.email ?? 'Unknown user'}</p>
          </div>
          <p className="text-xs text-fleet-mid">Version 0.1.0</p>
        </Card>

        <Card className="space-y-3">
          <p className="fleet-text-metal text-lg font-semibold text-fleet-white">Appearance</p>
          <p className="text-sm text-fleet-light">Command styling is active by default.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={themeMode === 'dark' ? 'primary' : 'ghost'}
              className="text-xs"
              onClick={() => {
                setThemeMode('dark');
                showToast('Theme set to Dark', 'info');
              }}
              block
            >
              Dark
            </Button>
            <Button
              variant={themeMode === 'deep' ? 'primary' : 'ghost'}
              className="text-xs"
              onClick={() => {
                setThemeMode('deep');
                showToast('Theme set to Deep', 'info');
              }}
              block
            >
              Deep
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="space-y-3">
          <p className="fleet-text-metal text-lg font-semibold text-fleet-white">Session Controls</p>
          <p className="text-sm text-fleet-light">End the current session on this device.</p>
          <Button onClick={onLogout} block>
            Logout
          </Button>
        </Card>

        <Card className="space-y-3">
          <p className="fleet-text-metal text-lg font-semibold text-fleet-white">System Status</p>
          <div className="space-y-3">
            <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
              <p className="text-xs text-fleet-mid">AUTHENTICATION</p>
              <p className="text-sm font-semibold text-fleet-white">Supabase Auth Active</p>
            </div>
            <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
              <p className="text-xs text-fleet-mid">DATA ACCESS</p>
              <p className="text-sm font-semibold text-fleet-white">RLS Policies Enforced</p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
