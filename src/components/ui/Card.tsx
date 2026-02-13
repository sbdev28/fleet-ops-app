import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-fleet-mid bg-fleet-dark p-4 shadow-sm ${className}`}>{children}</section>;
}
