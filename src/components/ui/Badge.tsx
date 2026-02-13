import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'info' | 'danger';

const toneClass: Record<BadgeTone, string> = {
  neutral: 'border-fleet-mid bg-fleet-black text-fleet-light',
  info: 'border-fleet-red bg-fleet-red/15 text-fleet-white',
  danger: 'border-fleet-danger bg-fleet-danger/15 text-fleet-white',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
