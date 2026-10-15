import type { HTMLAttributes, PropsWithChildren } from 'react'

interface CardProps
  extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'peach' | 'sage' | 'lilac'
}

const toneClasses = {
  default: 'border-line bg-card/85',
  peach: 'border-coral-200 bg-coral-50',
  sage: 'border-mint-200 bg-mint-50',
  lilac: 'border-lavender-200 bg-lavender-50',
}

export function Card({
  children,
  className = '',
  tone = 'default',
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-card ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
