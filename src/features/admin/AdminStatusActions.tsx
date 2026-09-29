import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import type { ContentStatus } from '../../domain/models/content-status'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useSnackbar } from '../../components/ui/SnackbarProvider'
import type { AdminActionData } from './admin-action'

export function AdminStatusActions({
  id,
  kind,
  status,
}: {
  id: string
  kind: 'course' | 'unit' | 'lesson'
  status: ContentStatus | undefined
}) {
  const fetcher = useFetcher<AdminActionData>()
  const { showError, showSuccess } = useSnackbar()
  const [pendingIntent, setPendingIntent] = useState<
    'publish' | 'archive' | 'restore' | null
  >(null)
  const waiting = useRef(false)
  useEffect(() => {
    if (waiting.current && fetcher.state === 'idle' && fetcher.data) {
      waiting.current = false
      if (fetcher.data.error) showError(fetcher.data.error)
      else showSuccess(fetcher.data.message ?? 'Content updated.')
    }
  }, [fetcher.data, fetcher.state, showError, showSuccess])
  const submit = (intent: string) => {
    waiting.current = true
    fetcher.submit({ intent, id, kind }, { method: 'post' })
  }
  const actions: Array<'publish' | 'archive' | 'restore'> =
    status === 'archived'
      ? ['restore']
      : status === 'published'
        ? ['archive']
        : ['publish', 'archive']
  return (
    <>
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          variant={action === 'archive' ? 'secondary' : 'primary'}
          onClick={() => setPendingIntent(action)}
        >
          {action[0].toUpperCase() + action.slice(1)}
        </Button>
      ))}
      <Modal
        open={pendingIntent !== null}
        title={`${pendingIntent?.[0].toUpperCase()}${pendingIntent?.slice(1)} ${kind}?`}
        onClose={() => setPendingIntent(null)}
      >
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          {pendingIntent === 'archive'
            ? 'This hides the content from learners without changing learner history.'
            : 'This change will update content visibility for learners.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingIntent(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (pendingIntent) submit(pendingIntent)
              setPendingIntent(null)
            }}
          >
            {pendingIntent?.[0].toUpperCase()}
            {pendingIntent?.slice(1)}
          </Button>
        </div>
      </Modal>
    </>
  )
}
