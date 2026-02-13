import { Outlet } from 'react-router-dom';
import { PageContainer } from './PageContainer';
import { BottomNav } from './BottomNav';
import { AppHeader } from './AppHeader';

export function AppLayout() {
  return (
    <>
      <PageContainer>
        <AppHeader />
        <section className="mt-6 space-y-4">
          <Outlet />
        </section>
      </PageContainer>
      <BottomNav />
    </>
  );
}
