import { useCallback, useState, type FormEvent } from 'react'
import { useFetcher } from 'react-router'
import type { Lesson } from '../../domain/models/lesson'
import { Button } from '../../components/ui/Button'
import { Dropdown } from '../../components/ui/Dropdown'
import { Modal } from '../../components/ui/Modal'
import type { AdminActionData } from './admin-action'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { useAdminTranslation } from './i18n/admin-i18n'
import { lessonTypes } from './lesson-types'

type CreateKind = 'course' | 'unit' | 'lesson'

const copy = {
  course: {
    intent: 'create-course',
    action: 'action.createCourse',
    title: 'draft.courseTitle',
    description: 'draft.courseDescription',
  },
  unit: {
    intent: 'create-unit',
    action: 'action.createUnit',
    title: 'draft.unitTitle',
    description: 'draft.unitDescription',
  },
  lesson: {
    intent: 'create-lesson',
    action: 'action.createLesson',
    title: 'draft.lessonTitle',
    description: null,
  },
} as const

/** Creates a Draft item from a modal and stays on the current page. */
export function AdminCreateButton({ kind }: { kind: CreateKind }) {
  const { t } = useAdminTranslation()
  const fetcher = useFetcher<AdminActionData>()
  const isPending = useAdminMutationPending()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<Lesson['type']>('word')
  const { intent, action, ...placeholder } = copy[kind]
  const close = useCallback(() => {
    setOpen(false)
    setTitle('')
    setDescription('')
    setType('word')
  }, [])
  useAdminFeedback(fetcher, close)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (isPending || !title.trim()) return
    fetcher.submit(
      {
        intent,
        title,
        ...(placeholder.description
          ? { description: description.trim() || t(placeholder.description) }
          : { type }),
      },
      { method: 'post' },
    )
  }
  return (
    <>
      <Button disabled={isPending} onClick={() => setOpen(true)}>
        {t(action)}
      </Button>
      <Modal
        open={open}
        title={t(action)}
        closeLabel={t('action.close')}
        sizeClassName="max-w-md"
        onClose={() => !isPending && close()}
      >
        <form className="mt-4 grid gap-4" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-semibold">
            <span>
              {t('field.title')}{' '}
              <span aria-hidden="true" className="text-[#a85d4e]">
                *
              </span>
            </span>
            <input
              value={title}
              autoFocus
              aria-required="true"
              placeholder={t(placeholder.title)}
              disabled={isPending}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
            />
          </label>
          {placeholder.description ? (
            <label className="grid gap-1 text-sm font-semibold">
              {t('field.description')}
              <textarea
                value={description}
                placeholder={t(placeholder.description)}
                disabled={isPending}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
          ) : (
            <Dropdown
              label={t('field.lessonType')}
              value={type}
              onChange={setType}
              disabled={isPending}
              options={lessonTypes.map((value) => ({
                value,
                label: t(`lessonType.${value}`),
              }))}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => close()}
            >
              {t('action.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? t('action.saving') : t(action)}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
