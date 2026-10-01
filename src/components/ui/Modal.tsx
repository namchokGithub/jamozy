import { useEffect, useId, useRef, type PropsWithChildren } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps extends PropsWithChildren {
  open: boolean
  title: string
  closeLabel?: string
  /** Width class for the dialog panel; defaults to a small dialog. */
  sizeClassName?: string
  onClose: () => void
}

export function Modal({ children, open, title, closeLabel = 'Close', sizeClassName = 'max-w-sm', onClose }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#253247]/30 p-4">
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${sizeClassName} rounded-3xl border border-[#eadfd4] bg-[#fffdf9] p-6 shadow-[0_24px_60px_-30px_rgba(54,41,31,0.5)]`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold tracking-tight text-[#253247]">
            {title}
          </h2>
          <Button
            aria-label={closeLabel}
            className="h-9 w-9 shrink-0 px-0 py-0"
            variant="ghost"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </Button>
        </div>
        {children}
      </section>
    </div>
  )
}
