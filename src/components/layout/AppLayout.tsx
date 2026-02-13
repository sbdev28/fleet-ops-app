import { Outlet } from 'react-router-dom';
import { PageContainer } from './PageContainer';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  return (
    <>
      <PageContainer>
        <Outlet />
      </PageContainer>
      <BottomNav />
    </>
  );
}
