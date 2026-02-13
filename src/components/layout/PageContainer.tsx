import type { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-fleet-black px-4 pt-6 pb-24 text-fleet-white">{children}</main>;
}
