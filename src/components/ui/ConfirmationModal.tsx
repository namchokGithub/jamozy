import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmationModalProps {
  open: boolean
  title: string
  body: string
  cancelLabel: string
  confirmLabel: string
  closeLabel: string
  isConfirming?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmationModal({
  open,
  title,
  body,
  cancelLabel,
  confirmLabel,
  closeLabel,
  isConfirming = false,
  onClose,
  onConfirm,
}: ConfirmationModalProps) {
  const close = () => {
    if (!isConfirming) onClose()
  }

  return (
    <Modal open={open} title={title} closeLabel={closeLabel} onClose={close}>
      <p className="mt-3 text-sm leading-6 text-[#667085]">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" disabled={isConfirming} onClick={close}>
          {cancelLabel}
        </Button>
        <Button disabled={isConfirming} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
