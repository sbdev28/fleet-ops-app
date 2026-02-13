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
        className="absolute inset-0 bg-fleet-black/80 backdrop-blur-[2px]"
        aria-label="Close sheet"
        onClick={onClose}
      />

      <section className="fleet-panel absolute inset-x-0 bottom-0 rounded-t-2xl border p-4 shadow-sm lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-full lg:max-w-xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="fleet-text-metal text-lg font-semibold text-fleet-white">{title}</h2>
          <button
            type="button"
            className="tap fleet-panel-subtle rounded-xl border border-fleet-mid px-3 text-sm text-fleet-light"
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
