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
    // `mt-auto` pins the footer to the bottom of a flex-column page whose
    // content is shorter than the screen; `pt-12` keeps the gap above it.
    <footer className="mt-auto pt-12 text-center text-xs text-subtle">
      <div className="border-t border-line/80 pt-5">
        <p>© 2026 Jamozy</p>
        <p className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-1">
          {links.map(({ label, href }, index) => (
            <span key={href} className="contents">
              {index > 0 && <span aria-hidden="true">·</span>}
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 transition hover:text-coral-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500"
              >
                {label}
              </a>
            </span>
          ))}
        </p>
      </div>
    </footer>
  )
}
