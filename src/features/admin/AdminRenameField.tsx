import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useFetcher } from 'react-router'
import { Button } from '../../components/ui/Button'
import type { AdminActionData } from './admin-action'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { useAdminTranslation } from './i18n/admin-i18n'

/** Inline title editor for a list row; other fields stay on the detail page. */
export function AdminRenameField({
  id,
  kind,
  title,
  onDone,
}: {
  id: string
  kind: 'course' | 'unit' | 'lesson'
  title: string
  onDone: () => void
}) {
  const { t } = useAdminTranslation()
  const fetcher = useFetcher<AdminActionData>()
  const isPending = useAdminMutationPending()
  const [value, setValue] = useState(title)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])
  useAdminFeedback(fetcher, onDone)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (isPending || !value.trim()) return
    if (value.trim() === title) return onDone()
    fetcher.submit(
      { intent: 'rename', kind, id, title: value },
      { method: 'post' },
    )
  }
  return (
    <form
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      onSubmit={submit}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape' && !isPending) onDone()
      }}
    >
      <input
        ref={input}
        value={value}
        aria-label={t('field.title')}
        aria-required="true"
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        className="min-w-0 flex-1 rounded-xl border border-[#eadfd4] bg-white px-3 py-1.5 text-base font-semibold"
      />
      <Button type="submit" disabled={isPending || !value.trim()}>
        {isPending ? t('action.saving') : t('action.saveChanges')}
      </Button>
      <Button variant="secondary" disabled={isPending} onClick={onDone}>
        {t('action.cancel')}
      </Button>
    </form>
  )
}
