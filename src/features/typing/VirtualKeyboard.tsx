import { KEY_TO_JAMO } from '../../domain/korean/keymap'

const ROW_1 = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP']
const ROW_2 = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL']
const ROW_3 = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period']
const ROWS = [ROW_1, ROW_2, ROW_3]

function englishLabel(code: string): string {
  if (code === 'Comma') return ','
  if (code === 'Period') return '.'
  return code.replace('Key', '').toLowerCase()
}

interface VirtualKeyboardProps {
  nextKey?: { code: string; shift: boolean }
  showEnglishKeys: boolean
  opacity: number
}

export default function VirtualKeyboard({
  nextKey,
  showEnglishKeys,
  opacity,
}: VirtualKeyboardProps) {
  return (
    <div className="mt-6 rounded-3xl border border-[#eadfd4] bg-[#fffdf9] p-4 shadow-sm select-none" aria-label="Virtual Korean keyboard" style={{ opacity }}>
      <div
        className={`mb-2 inline-block rounded-md border px-3 py-1 text-sm ${
          nextKey?.shift ? 'border-[#e4bd79] bg-[#fff0d8] text-[#8b6035]' : 'border-[#eadfd4] bg-white/70 text-[#667085]'
        }`}
      >
        Shift
      </div>
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="mb-1 flex gap-1">
          {row.map((code) => {
            const jamo = KEY_TO_JAMO[code]
            const isNext = nextKey?.code === code
            return (
              <div
                key={code}
                className={`flex h-12 w-12 flex-col items-center justify-center rounded-md border text-sm ${
                  isNext ? 'border-[#e4bd79] bg-[#fff0d8] text-[#8b6035]' : 'border-[#eadfd4] bg-white/70 text-[#39465b]'
                }`}
              >
                <span className="text-base">{jamo.base}</span>
                {showEnglishKeys && (
                  <span className="text-[10px] text-slate-400">{englishLabel(code)}</span>
                )}
              </div>
            )
          })}
        </div>
      ))}
      <div className="mt-1 h-8 w-full rounded-xl border border-[#eadfd4] bg-white/70" aria-label="Space" />
    </div>
  )
}
