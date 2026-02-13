import type { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-fleet-black px-4 pt-6 pb-24 text-fleet-white lg:px-6 lg:pb-8">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl">{children}</div>
    </main>
  );
}
