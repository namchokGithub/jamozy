import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

interface ButtonProps
  extends PropsWithChildren, ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

const variantClasses = {
  primary:
    'border-[#a85d4e] bg-[#a85d4e] text-white hover:bg-[#8d4c43] focus-visible:outline-[#bc6c5d]',
  secondary:
    'border-[#eadfd4] bg-white/90 text-[#39465b] hover:border-[#d8b3a9] hover:text-[#8d4c43] focus-visible:outline-[#bc6c5d]',
  ghost:
    'border-transparent bg-transparent text-[#667085] hover:bg-white/70 hover:text-[#8d4c43] focus-visible:outline-[#bc6c5d]',
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
