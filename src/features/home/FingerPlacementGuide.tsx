const hands = [
  {
    title: 'Left hand',
    fingers: [
      ['Pinky', '~ · 1 · Q · A · Z · Tab · Caps · Shift'],
      ['Ring', '2 · W · S · X'],
      ['Middle', '3 · E · D · C'],
      ['Index', '4 · 5 · R · T · F · G · V · B'],
      ['Thumb', 'Spacebar'],
    ],
  },
  {
    title: 'Right hand',
    fingers: [
      ['Pinky', '= · - · 0 · ) · P · ; · : · / · ? · \' · " · [ · { · ] · } · Enter · Shift'],
      ['Ring', '9 · O · L · . · >'],
      ['Middle', '8 · I · K · , · <'],
      ['Index', '6 · 7 · Y · U · J · H · N · M'],
      ['Thumb', 'Spacebar'],
    ],
  },
] as const

export default function FingerPlacementGuide() {
  return (
    <section className="mt-4 grid gap-3 rounded-2xl border border-[#eadfd4] bg-white/70 p-4 text-sm text-[#596579] sm:grid-cols-2" aria-labelledby="finger-placement-heading">
      <h3 id="finger-placement-heading" className="sr-only">Finger placement</h3>
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
    </section>
  )
}
