import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`fleet-panel rounded-2xl border p-4 shadow-sm ${className}`}>{children}</section>;
}
