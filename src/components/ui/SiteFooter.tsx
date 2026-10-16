const links = [
  {
    label: 'MIT License',
    href: 'https://github.com/namchokGithub/jamozy/blob/main/LICENSE',
  },
  { label: 'GitHub', href: 'https://github.com/namchokGithub/jamozy' },
  { label: 'Inspired by Type Hangeul', href: 'https://typehangeul.com/' },
]

const faqs = [
  {
    question: 'What is Jamozy?',
    answer:
      'Jamozy is a cozy Korean typing practice app designed to help you learn Hangul while building speed and accuracy.',
  },
  {
    question: 'How Does It Work?',
    answer:
      'Choose a course, follow the lessons, and practice typing Korean step by step. Jamozy tracks your accuracy, speed, and progress as you learn.',
  },
  {
    question: 'Do I Need an Account?',
    answer:
      'No. You can start practicing right away. Create an account when you want to save and sync your progress.',
  },
]

export function SiteFooter() {
  return (
    // `mt-auto` pins the footer to the bottom of a flex-column page whose
    // content is shorter than the screen; `pt-12` keeps the gap above it.
    <footer className="mt-auto pt-12 text-center text-xs text-subtle">
      <div className="border-t border-line/80 pt-8">
        <section
          aria-labelledby="footer-about-heading"
          className="mx-auto max-w-4xl"
        >
          <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-coral-600">
            A LITTLE MORE ABOUT JAMOZY
          </p>
          <h2
            id="footer-about-heading"
            className="mt-2 text-base font-semibold text-ink"
          >
            Curious about Jamozy?
          </h2>

          <div className="mt-5 overflow-hidden rounded-xl border border-line/80 text-left">
            {faqs.map(({ question, answer }) => (
              <details
                key={question}
                className="group border-b border-line/80 last:border-b-0"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-ink marker:content-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-coral-500">
                  {question}
                  <span
                    aria-hidden="true"
                    className="text-lg font-normal leading-none"
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm leading-6 text-subtle">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-8">
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
      </div>
    </footer>
  )
}
