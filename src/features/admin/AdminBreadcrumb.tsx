import { ChevronRight } from 'lucide-react'

export function AdminBreadcrumb({ items }: { items: string[] }) {
  return (
    <nav
      aria-label="Content location"
      className="flex flex-wrap items-center gap-1.5 text-sm"
    >
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && (
            <ChevronRight
              aria-hidden="true"
              size={14}
              className="text-[#b7aa9f]"
            />
          )}
          <span
            className={
              index === items.length - 1
                ? 'font-semibold text-[#39465b]'
                : 'text-[#8b7d72]'
            }
          >
            {item}
          </span>
        </span>
      ))}
    </nav>
  )
}
