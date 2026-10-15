import type { PropsWithChildren, ReactNode } from 'react'

interface PageHeadingProps extends PropsWithChildren {
  eyebrow: string
  title: ReactNode
  className?: string
}

// The rounded title card Home and the Course Map open with.
export function PageHeading({
  eyebrow,
  title,
  className = '',
  children,
}: PageHeadingProps) {
  return (
    <header
      className={`rounded-4xl border border-line-soft bg-card px-6 py-8 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] ${className}`}
    >
      <p className="text-sm font-semibold text-coral-600">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      {children}
    </header>
  )
}
