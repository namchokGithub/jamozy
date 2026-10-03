import { Info } from 'lucide-react'

type Finger = 'Pinky' | 'Ring' | 'Middle' | 'Index' | 'Thumb'

const hands = [
  {
    title: 'Left hand',
    fingers: [
      ['Pinky', '~ · 1 · Q · A · Z · Tab · Caps · Shift'],
      ['Ring', '2 · W · S · X'],
      ['Middle', '3 · E · D · C'],
      ['Index', '4 · 5 · R · T · F · G · V · B'],
      ['Thumb', 'Space (optional)'],
    ],
  },
  {
    title: 'Right hand',
    fingers: [
      [
        'Pinky',
        '= · - · 0 · ) · P · ; · : · / · ? · \' · " · [ · { · ] · } · Enter · Shift',
      ],
      ['Ring', '9 · O · L · . · >'],
      ['Middle', '8 · I · K · , · <'],
      ['Index', '6 · 7 · Y · U · J · H · N · M'],
      ['Thumb', 'Space'],
    ],
  },
] as const

const fingerCodes: Record<'left' | 'right', Record<Finger, string[]>> = {
  left: {
    Pinky: ['Tab', 'CapsLock', 'ShiftLeft', 'KeyQ', 'KeyA', 'KeyZ'],
    Ring: ['KeyW', 'KeyS', 'KeyX'],
    Middle: ['KeyE', 'KeyD', 'KeyC'],
    Index: ['KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyV', 'KeyB'],
    Thumb: [],
  },
  right: {
    Pinky: [
      'ShiftRight',
      'Enter',
      'KeyP',
      'Semicolon',
      'Quote',
      'BracketLeft',
      'BracketRight',
      'Backslash',
      'Slash',
    ],
    Ring: ['KeyO', 'KeyL', 'Period'],
    Middle: ['KeyI', 'KeyK', 'Comma'],
    Index: ['KeyY', 'KeyU', 'KeyJ', 'KeyH', 'KeyN', 'KeyM'],
    Thumb: ['Space'],
  },
}

const FINGERS: Finger[] = ['Pinky', 'Ring', 'Middle', 'Index', 'Thumb']

interface FingerPlacementGuideProps {
  nextKey?: { code: string; shift: boolean }
}

function activeFingerFor(
  side: 'left' | 'right',
  nextKey?: FingerPlacementGuideProps['nextKey'],
) {
  return FINGERS.find(
    (finger) => nextKey && fingerCodes[side][finger].includes(nextKey.code),
  )
}

function HandSilhouette({
  side,
  nextKey,
}: {
  side: 'left' | 'right'
  nextKey?: FingerPlacementGuideProps['nextKey']
}) {
  const activeFinger = activeFingerFor(side, nextKey)
  const fingerClass = (finger: Finger) =>
    `transition-[fill] duration-150 ${finger === activeFinger ? 'fill-[#c84f82]' : 'fill-[#dce4f1]'}`
  return (
    <div className="flex min-w-24 flex-col items-center gap-1.5">
      <svg
        viewBox="0 0 121 130"
        className="h-25 w-25"
        aria-label={`${side} hand finger guide`}
        role="img"
      >
        <g transform={side === 'right' ? 'translate(121 0) scale(-1 1)' : undefined}>
          <g transform="translate(4 4)">
            <path
              className="fill-[#dce4f1]"
              d="M17 67 H76 L79 82 L90 64 C94 57 100 55 105 59 C110 63 110 69 106 74 L81 106 C77 112 72 114 65 114 H43 C29 114 19 105 17 91 Z"
            />
            <g className={fingerClass('Thumb')}>
              <path d="M73 82 L90 61 C95 55 101 54 106 59 C111 63 110 69 106 74 L82 104 C79 108 73 107 70 102 L66 94 Z" />
            </g>
            <g className={fingerClass('Pinky')}>
              <path d="M15 41 C15 36 18 33 22 33 C26 33 29 36 29 41 L31 79 L17 82 Z" />
            </g>
            <g className={fingerClass('Ring')}>
              <path d="M30 27 C30 22 33 19 37 19 C41 19 44 22 44 27 L45 79 H31 Z" />
            </g>
            <g className={fingerClass('Middle')}>
              <path d="M45 19 C45 14 48 11 52 11 C56 11 59 14 59 19 L60 79 H45 Z" />
            </g>
            <g className={fingerClass('Index')}>
              <path d="M61 19 C61 14 64 11 68 11 C72 11 75 14 75 19 L76 79 H61 Z" />
            </g>
          </g>
        </g>
      </svg>
      <p className="text-xs font-semibold text-[#667085]">
        {side === 'left' ? 'Left Hand' : 'Right Hand'}
      </p>
      <p
        className={`rounded-full px-3 py-1 text-[10px] font-semibold ${activeFinger ? 'bg-[#fde7ef] text-[#c84f82]' : 'bg-[#f2edf9] text-[#98a2b3]'}`}
      >
        {activeFinger ?? 'Ready'}
      </p>
    </div>
  )
}

export default function FingerPlacementGuide({
  nextKey,
}: FingerPlacementGuideProps) {
  return (
    <section
      className="relative mt-4 rounded-2xl border border-[#eadfd4] bg-white/70 p-3"
      aria-label="Finger placement guide"
    >
      <div className="flex items-start justify-center gap-12 sm:gap-24">
        <HandSilhouette side="left" nextKey={nextKey} />
        <HandSilhouette side="right" nextKey={nextKey} />
      </div>
      <div className="group absolute right-3 top-3">
        <button
          type="button"
          aria-label="Show finger placement details"
          aria-describedby="finger-placement-tooltip"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d8e3f2] bg-white text-[#7863a8] shadow-sm transition hover:bg-[#f2edf9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
        >
          <Info aria-hidden="true" size={15} />
        </button>
        <div
          id="finger-placement-tooltip"
          role="tooltip"
          className="pointer-events-none absolute right-0 top-9 z-10 grid w-80 origin-top-right gap-3 rounded-2xl border border-[#eadfd4] bg-[#fffdf9] p-3 text-sm text-[#596579] opacity-0 shadow-[0_18px_40px_-24px_rgba(54,41,31,0.5)] transition group-hover:opacity-100 group-focus-within:opacity-100 sm:grid-cols-2"
        >
          {hands.map((hand) => (
            <div key={hand.title}>
              <p className="font-bold text-[#39465b]">{hand.title}</p>
              <dl className="mt-2 space-y-1">
                {hand.fingers.map(([finger, keys]) => (
                  <div key={finger} className="flex gap-2 leading-5">
                    <dt className="w-14 shrink-0 font-semibold text-[#a85d4e]">
                      {finger}
                    </dt>
                    <dd>{keys}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
