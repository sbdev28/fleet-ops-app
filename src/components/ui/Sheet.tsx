import type { ReactNode } from 'react';

type SheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ open, title, onClose, children }: SheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-fleet-black/80"
        aria-label="Close sheet"
        onClick={onClose}
      />

      <section className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-fleet-mid bg-fleet-dark p-4 shadow-sm">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-fleet-white">{title}</h2>
          <button
            type="button"
            className="tap rounded-xl border border-fleet-mid bg-fleet-black px-3 text-sm text-fleet-light"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
