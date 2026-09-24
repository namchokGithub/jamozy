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
}

export default function VirtualKeyboard({ nextKey }: VirtualKeyboardProps) {
  return (
    <div className="mt-6 select-none">
      <div
        className={`mb-2 inline-block rounded-md border px-3 py-1 text-sm ${
          nextKey?.shift ? 'border-amber-400 bg-amber-100' : 'border-slate-200 text-slate-400'
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
                  isNext ? 'border-amber-400 bg-amber-100' : 'border-slate-200'
                }`}
              >
                <span className="text-base">{jamo.base}</span>
                <span className="text-[10px] text-slate-400">{englishLabel(code)}</span>
              </div>
            )
          })}
        </div>
      ))}
      <div className="mt-1 h-8 w-full rounded-md border border-slate-200" aria-label="Space" />
    </div>
  )
}
