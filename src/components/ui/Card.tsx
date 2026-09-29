import type { HTMLAttributes, PropsWithChildren } from 'react'

interface CardProps
  extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'peach' | 'sage' | 'lilac'
}

const toneClasses = {
  default: 'border-[#eadfd4] bg-white/85',
  peach: 'border-[#f0d2c8] bg-[#fff5f1]',
  sage: 'border-[#d8e4c7] bg-[#f5faed]',
  lilac: 'border-[#e1d8f2] bg-[#f8f5ff]',
}

export function Card({
  children,
  className = '',
  tone = 'default',
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-[0_14px_35px_-28px_rgba(54,41,31,0.7)] ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
