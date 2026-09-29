import { Check, ChevronDown } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type SelectHTMLAttributes,
} from 'react'

interface DropdownOption<T extends string> {
  value: T
  label: string
}

interface DropdownProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  label: string
  options: DropdownOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  id,
  className = '',
  disabled,
}: DropdownProps<T>) {
  const generatedId = useId()
  const triggerId = id ?? generatedId
  const listboxId = `${triggerId}-options`
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected =
    options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function select(option: DropdownOption<T>) {
    onChange(option.value)
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className="grid gap-2 text-sm font-semibold text-[#39465b]"
    >
      <span id={`${triggerId}-label`}>{label}</span>
      <div className="relative">
        <button
          id={triggerId}
          type="button"
          disabled={disabled}
          aria-label={`${label}: ${selected?.label ?? ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((current) => !current)}
          className={`flex w-full items-center justify-between rounded-2xl border border-[#eadfd4] bg-white/90 px-3 py-2.5 text-left text-sm font-medium text-[#253247] shadow-sm outline-none hover:border-[#d8b3a9] focus:border-[#d8b3a9] focus:ring-2 focus:ring-[#f2c5bb] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
          <span>{selected?.label}</span>
          <ChevronDown
            aria-hidden="true"
            size={17}
            className="text-[#a85d4e]"
          />
        </button>
        {open && (
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={`${triggerId}-label`}
            className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-[#eadfd4] bg-[#fffdf9] p-1.5 shadow-[0_18px_38px_-20px_rgba(54,41,31,0.45)]"
          >
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => select(option)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#f2c5bb] ${isSelected ? 'bg-[#f8e5df] text-[#8d4c43]' : 'text-[#39465b] hover:bg-[#fff6ef]'}`}
                >
                  {option.label}
                  {isSelected && <Check aria-hidden="true" size={16} />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
