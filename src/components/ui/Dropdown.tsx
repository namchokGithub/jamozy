import { useId, type SelectHTMLAttributes } from 'react'

interface DropdownOption<T extends string> {
  value: T
  label: string
}

interface DropdownProps<T extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
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
  ...props
}: DropdownProps<T>) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <label className="grid gap-2 text-sm font-semibold text-[#39465b]" htmlFor={selectId}>
      {label}
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={`w-full rounded-2xl border border-[#eadfd4] bg-white/90 px-3 py-2.5 text-sm font-medium text-[#253247] shadow-sm outline-none focus:border-[#d8b3a9] focus:ring-2 focus:ring-[#f2c5bb] ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
