import type { InputHTMLAttributes } from 'react';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={[
        'tap w-full rounded-xl border border-fleet-mid bg-fleet-black px-3 text-sm text-fleet-white',
        'placeholder:text-fleet-mid',
        className,
      ].join(' ')}
      {...props}
    />
  );
}
