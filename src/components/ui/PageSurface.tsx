import type { PropsWithChildren } from 'react'

interface PageSurfaceProps extends PropsWithChildren {
  className?: string
  contentClassName?: string
}

export function PageSurface({
  children,
  className = '',
  contentClassName = 'max-w-4xl',
}: PageSurfaceProps) {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[#fffaf1] px-4 py-5 text-[#253247] sm:px-6 sm:py-8 ${className}`}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-[#f8d9d4]/50 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#dce9c8]/50 blur-3xl" />
      </div>
      <div className={`relative z-10 mx-auto w-full ${contentClassName}`}>
        {children}
      </div>
    </main>
  )
}
