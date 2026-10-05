// Shown while the Home loader runs on a fresh page load, so a refresh shows
// the page frame instead of a blank screen.
export default function CourseListPageFallback() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#fffaf1] px-4 py-5 text-[#253247] sm:px-6 sm:py-8"
      aria-busy="true"
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-[#f8d9d4]/50 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#dce9c8]/50 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/templates/jamozy-hanguk-180x180.png"
              alt=""
              className="h-15 w-15 object-contain"
            />
            <span className="text-xl font-bold tracking-tight">Jamozy</span>
          </div>
          <div className="flex gap-2" aria-hidden="true">
            <div className="h-10 w-24 animate-pulse rounded-full bg-[#f2edf9]" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-[#f2edf9]" />
          </div>
        </header>

        <section
          className="mt-7 rounded-4xl border border-[#d9d1ed] bg-[#fffdf9] p-5 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] sm:p-7"
          aria-label="Loading your practice room"
        >
          <div className="h-4 w-44 animate-pulse rounded-full bg-[#f2edf9]" />
          <div className="mt-3 h-7 w-56 animate-pulse rounded-full bg-[#f2edf9]" />
          <div className="mt-5 flex gap-2">
            <div className="h-9 w-28 animate-pulse rounded-full bg-[#f2edf9]" />
            <div className="h-9 w-28 animate-pulse rounded-full bg-[#f2edf9]" />
          </div>
          <div className="mt-4 h-48 animate-pulse rounded-3xl bg-[#fffaf6]" />
          <div className="mt-4 h-40 animate-pulse rounded-3xl bg-[#f7f2ec]" />
        </section>
      </div>
    </main>
  )
}
