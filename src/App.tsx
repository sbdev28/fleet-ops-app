import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AlertsPage } from './pages/AlertsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { AssetsPage } from './pages/AssetsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LogPage } from './pages/LogPage';
import { LoginPage } from './pages/LoginPage';
import { MorePage } from './pages/MorePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute, PublicOnlyRoute } from './lib/routeGuards';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/log" element={<LogPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/more" element={<MorePage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
