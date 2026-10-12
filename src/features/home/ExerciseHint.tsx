import { useId } from 'react'
import { Lightbulb } from 'lucide-react'

export default function ExerciseHint({ hint }: { hint: string | null }) {
  const tooltipId = useId()
  if (!hint?.trim()) return null

  return (
    <div className="group relative mt-3 flex justify-center">
      <button
        type="button"
        aria-label="Show exercise hint"
        aria-describedby={tooltipId}
        onKeyDown={(event) => event.stopPropagation()}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ebdebe] bg-[#fff8df] text-[#d6a146] shadow-sm transition hover:bg-[#fff0bb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
      >
        <Lightbulb aria-hidden="true" size={17} />
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute top-10 z-10 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-[#f2e2bb] bg-[#fffdf4] px-4 py-3 text-center text-sm leading-6 whitespace-pre-wrap text-[#805c19] opacity-0 shadow-[0_18px_40px_-24px_rgba(54,41,31,0.5)] transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {hint.trim()}
      </div>
    </div>
  )
}
