import type { InputHTMLAttributes } from 'react';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={[
        'tap fleet-field',
        className,
      ].join(' ')}
      {...props}
    />
  );
}
