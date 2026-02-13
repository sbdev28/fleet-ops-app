import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth';

export function ProtectedRoute() {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-fleet-black px-4 pt-6 pb-24 text-fleet-white">
        <p className="text-sm text-fleet-light">Loading session...</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-fleet-black px-4 pt-6 pb-24 text-fleet-white">
        <p className="text-sm text-fleet-light">Loading session...</p>
      </main>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
