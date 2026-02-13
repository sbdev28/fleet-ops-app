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
  const base = 'tap inline-flex items-center justify-center rounded-xl border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const byVariant =
    variant === 'primary'
      ? 'border-fleet-blue bg-fleet-blue px-4 text-fleet-white hover:bg-fleet-blueHover'
      : 'border-fleet-mid bg-transparent px-4 text-fleet-light hover:bg-fleet-dark';
  const widthClass = block ? 'w-full' : '';

  return <button type={type} className={`${base} ${byVariant} ${widthClass} ${className}`.trim()} {...rest} />;
}
