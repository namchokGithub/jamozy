import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

interface ButtonProps
  extends PropsWithChildren, ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

const variantClasses = {
  primary:
    'border-coral-600 bg-coral-600 text-white hover:bg-coral-700 focus-visible:outline-coral-500',
  secondary:
    'border-line bg-white/90 text-ink-soft hover:border-line-hover hover:text-coral-700 focus-visible:outline-coral-500',
  ghost:
    'border-transparent bg-transparent text-muted hover:bg-white/70 hover:text-coral-700 focus-visible:outline-coral-500',
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
