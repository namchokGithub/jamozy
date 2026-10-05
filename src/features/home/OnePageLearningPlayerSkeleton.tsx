// Placeholder for the Home player while its learning path loads.
export default function OnePageLearningPlayerSkeleton() {
  return (
    <section
      className="mt-7 rounded-4xl border border-[#d9d1ed] bg-[#fffdf9] p-5 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] sm:p-7"
      aria-label="Loading your practice room"
      aria-busy="true"
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
  )
}
