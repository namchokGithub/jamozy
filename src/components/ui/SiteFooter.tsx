const links = [
  {
    label: 'MIT License',
    href: 'https://github.com/namchokGithub/jamozy/blob/main/LICENSE',
  },
  { label: 'GitHub', href: 'https://github.com/namchokGithub/jamozy' },
  { label: 'Inspired by Type Hangeul', href: 'https://typehangeul.com/' },
]

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-[#eadfd4]/80 pt-5 text-center text-xs text-[#7c8795]">
      <p>© 2026 Jamozy</p>
      <p className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-1">
        {links.map(({ label, href }, index) => (
          <span key={href} className="contents">
            {index > 0 && <span aria-hidden="true">·</span>}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 transition hover:text-[#a85d4e] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
            >
              {label}
            </a>
          </span>
        ))}
      </p>
    </footer>
  )
}
