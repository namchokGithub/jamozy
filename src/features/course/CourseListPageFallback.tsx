// Shown only until the Home loader knows the user (page data and the Home
// player stream in afterwards), so a refresh shows the page frame instead of
// a blank screen.
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
      </div>
    </main>
  )
}
