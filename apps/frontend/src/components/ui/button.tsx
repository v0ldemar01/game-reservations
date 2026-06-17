import { type ButtonHTMLAttributes } from 'react';

import { Spinner } from './spinner.js';

interface Properties extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'danger' | 'ghost' | 'primary' | 'secondary';
}

const variants = {
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost:
    'text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50',
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50'
};

export function Button({
  children,
  className = '',
  disabled,
  loading,
  variant = 'primary',
  ...props
}: Readonly<Properties>) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${variants[variant]} ${className}`}
      disabled={disabled ?? loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
