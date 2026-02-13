import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  block?: boolean;
};

export function Button({
  variant = 'primary',
  block = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const base =
    'tap inline-flex items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-all ' +
    'focus-visible:ring-2 focus-visible:ring-fleet-red/60 disabled:cursor-not-allowed disabled:opacity-50';
  const byVariant =
    variant === 'primary'
      ? 'border-fleet-red bg-gradient-to-b from-fleet-red to-fleet-redHover text-fleet-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_18px_rgba(153,27,27,0.3)] hover:brightness-105'
      : 'fleet-panel-subtle border-fleet-mid text-fleet-light hover:border-fleet-red/50 hover:text-fleet-white';
  const widthClass = block ? 'w-full' : '';

  return <button type={type} className={`${base} ${byVariant} ${widthClass} ${className}`.trim()} {...rest} />;
}
