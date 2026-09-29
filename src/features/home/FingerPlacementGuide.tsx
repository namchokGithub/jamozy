import { Info } from 'lucide-react'
import { useState } from 'react'

type Finger = 'Pinky' | 'Ring' | 'Middle' | 'Index'

const hands = [
  {
    title: 'Left hand',
    fingers: [
      ['Pinky', '~ · 1 · Q · A · Z · Tab · Caps · Shift'],
      ['Ring', '2 · W · S · X'],
      ['Middle', '3 · E · D · C'],
      ['Index', '4 · 5 · R · T · F · G · V · B'],
    ],
  },
  {
    title: 'Right hand',
    fingers: [
      ['Pinky', '= · - · 0 · ) · P · ; · : · / · ? · \' · " · [ · { · ] · } · Enter · Shift'],
      ['Ring', '9 · O · L · . · >'],
      ['Middle', '8 · I · K · , · <'],
      ['Index', '6 · 7 · Y · U · J · H · N · M'],
    ],
  },
] as const

const fingerCodes: Record<'left' | 'right', Record<Finger, string[]>> = {
  left: {
    Pinky: ['Tab', 'CapsLock', 'ShiftLeft', 'KeyQ', 'KeyA', 'KeyZ'],
    Ring: ['KeyW', 'KeyS', 'KeyX'],
    Middle: ['KeyE', 'KeyD', 'KeyC'],
    Index: ['KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyV', 'KeyB'],
  },
  right: {
    Pinky: ['ShiftRight', 'Enter', 'KeyP', 'Semicolon', 'Quote', 'BracketLeft', 'BracketRight', 'Backslash', 'Slash'],
    Ring: ['KeyO', 'KeyL', 'Period'],
    Middle: ['KeyI', 'KeyK', 'Comma'],
    Index: ['KeyY', 'KeyU', 'KeyJ', 'KeyH', 'KeyN', 'KeyM'],
  },
}

const fingerHeights: Record<Finger, string> = {
  Pinky: 'h-5',
  Ring: 'h-7',
  Middle: 'h-9',
  Index: 'h-7',
}
const fingerOrder: Record<'left' | 'right', Finger[]> = {
  left: ['Pinky', 'Ring', 'Middle', 'Index'],
  right: ['Index', 'Middle', 'Ring', 'Pinky'],
}

interface FingerPlacementGuideProps {
  nextKey?: { code: string; shift: boolean }
}

function HandBars({ side, nextKey }: { side: 'left' | 'right'; nextKey?: FingerPlacementGuideProps['nextKey'] }) {
  const activeFinger = fingerOrder[side].find((finger) =>
    nextKey && fingerCodes[side][finger].includes(nextKey.code),
  )
  return (
    <div className="flex h-15 items-end gap-1 rounded-xl bg-[#f7f8fb] px-3 py-2" aria-label={`${side} hand finger guide`}>
      {fingerOrder[side].map((finger) => (
        <span
          key={finger}
          className={`w-3 rounded-full ${fingerHeights[finger]} ${finger === activeFinger ? 'bg-[#d99cb0]' : 'bg-[#cbd6e6]'}`}
          title={finger}
        />
      ))}
    </div>
  )
}

export default function FingerPlacementGuide({ nextKey }: FingerPlacementGuideProps) {
  const [showDetails, setShowDetails] = useState(false)
  return (
    <section className="relative mt-4 rounded-2xl border border-[#eadfd4] bg-white/70 p-3" aria-label="Finger placement guide">
      <div className="flex items-center justify-center gap-16 sm:gap-28">
        <HandBars side="left" nextKey={nextKey} />
        <HandBars side="right" nextKey={nextKey} />
      </div>
      <div className="absolute right-3 top-3">
        <button
          type="button"
          aria-label="Show finger placement details"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((open) => !open)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d8e3f2] bg-white text-[#7863a8] shadow-sm transition hover:bg-[#f2edf9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
        >
          <Info aria-hidden="true" size={15} />
        </button>
      </div>
      {showDetails && (
        <div className="mt-3 grid gap-3 border-t border-[#eadfd4] pt-3 text-sm text-[#596579] sm:grid-cols-2">
          {hands.map((hand) => (
            <div key={hand.title}>
              <p className="font-bold text-[#39465b]">{hand.title}</p>
              <dl className="mt-2 space-y-1">
                {hand.fingers.map(([finger, keys]) => (
                  <div key={finger} className="flex gap-2 leading-5">
                    <dt className="w-14 shrink-0 font-semibold text-[#a85d4e]">{finger}</dt>
                    <dd>{keys}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
