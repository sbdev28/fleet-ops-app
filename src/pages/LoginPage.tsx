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
      <div className="mx-auto mt-10 w-full max-w-md space-y-4">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-fleet-white">FleetOps Command Access</h1>
          <p className="text-sm text-fleet-light">Sign in with your Supabase account to access your fleet workspace.</p>
        </header>

        <Card>
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

            {errorMessage ? <p className="text-sm text-fleet-danger">{errorMessage}</p> : null}

            <Button type="submit" block disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
