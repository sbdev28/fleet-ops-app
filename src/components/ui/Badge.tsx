import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'info' | 'danger';

const toneClass: Record<BadgeTone, string> = {
  neutral: 'fleet-panel-subtle border-fleet-mid text-fleet-light',
  info: 'border-fleet-red/70 bg-fleet-red/15 text-fleet-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
  danger: 'border-fleet-danger bg-fleet-danger/20 text-fleet-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
