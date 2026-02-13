import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { supabase } from '../supabaseClient';
import { PageContainer } from '../components/layout/PageContainer';

type LocationState = {
  from?: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    navigate(state?.from ?? '/dashboard', { replace: true });
  };

  return (
    <PageContainer>
      <div className="mx-auto mt-8 w-full max-w-md space-y-4 lg:mt-10 lg:grid lg:max-w-5xl lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:space-y-0">
        <Card className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs tracking-[0.2em] text-fleet-mid">SECURE ACCESS</p>
            <h1 className="fleet-text-metal text-xl font-semibold text-fleet-white">FleetOps Command Access</h1>
            <p className="text-sm text-fleet-light">Authenticated Supabase session for your fleet workspace.</p>
          </div>

          <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-fleet-white">System Readiness</p>
              <p className="text-sm text-fleet-light">RLS enforced • Storage private • Audit-safe operations</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
              <p className="text-xs text-fleet-mid">MODE</p>
              <p className="text-sm font-semibold text-fleet-white">Production</p>
            </div>
            <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
              <p className="text-xs text-fleet-mid">THEME</p>
              <p className="text-sm font-semibold text-fleet-white">Command Red</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-fleet-light">Email</span>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-fleet-light">Password</span>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {errorMessage ? (
              <p className="fleet-panel-subtle rounded-xl border border-fleet-danger/70 p-3 text-sm text-fleet-danger">
                {errorMessage}
              </p>
            ) : null}

            <Button type="submit" block disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
