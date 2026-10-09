import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

interface PageNavProps {
  backTo: string
  backLabel: string
}

// Top bar for inner pages: the logo returns Home, the pill goes one level up.
export function PageNav({ backTo, backLabel }: PageNavProps) {
  return (
    <nav
      aria-label="Page navigation"
      className="mb-5 flex items-center justify-between gap-3"
    >
      <Link
        to="/"
        className="flex items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bc6c5d]"
      >
        <img
          src="/templates/jamozy-hanguk-180x180.png"
          alt=""
          className="h-11 w-11 object-contain sm:h-15 sm:w-15"
        />
        <span className="text-xl font-bold tracking-tight">Jamozy</span>
      </Link>
      <Link
        to={backTo}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#eadfd4] bg-white/80 px-3 py-2 text-sm font-medium text-[#39465b] shadow-sm transition hover:border-[#d8b3a9] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
      >
        <ArrowLeft aria-hidden="true" size={15} />
        {backLabel}
      </Link>
    </nav>
  )
}
