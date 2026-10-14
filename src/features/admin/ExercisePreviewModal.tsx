import { useEffect, useMemo, useState } from 'react'
import type { LessonExercise } from '../../domain/models/lesson'
import { startTypingSession } from '../../domain/korean/typing-session'
import {
  loadJamoSvgGlyphs,
  peekJamoSvgGlyphs,
} from '../../infrastructure/jamo-svg/jamo-svg-dataset'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import DecomposedHangulTarget from '../typing/DecomposedHangulTarget'
import { TargetWords } from '../typing/JamoSvgHangulTarget'
import {
  chooseRenderer,
  svgTargetSyllables,
  targetSyllables,
  type RendererChoice,
} from '../typing/hangul-target-selection'
import { JAMO_SVG_LOAD_TIMEOUT_MS } from '../typing/HangulTarget'
import { useAdminTranslation } from './i18n/admin-i18n'

const STEP_COLORS = ['#e66c58', '#4c8f8b', '#7866b8', '#bd7c2b', '#5b8c5a']

interface ExercisePreviewModalProps {
  exercises: LessonExercise[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

export function ExercisePreviewModal({
  exercises,
  selectedId,
  onSelect,
  onClose,
}: ExercisePreviewModalProps) {
  const { t } = useAdminTranslation()
  const index = exercises.findIndex((exercise) => exercise.id === selectedId)
  const exercise = exercises[index]
  const targetText = exercise?.targetText ?? ''
  const session = useMemo(() => {
    if (!targetText.trim()) return null
    try {
      return startTypingSession(targetText)
    } catch {
      return null
    }
  }, [targetText])
  const groups = useMemo(
    () =>
      session
        ? svgTargetSyllables(session.targetText, session.expectedKeys)
        : undefined,
    [session],
  )
  const cachedChoice = useMemo(() => {
    if (!groups) return undefined
    const loaded = peekJamoSvgGlyphs(targetSyllables(groups))
    return loaded ? chooseRenderer(groups, loaded) : undefined
  }, [groups])
  const [loadedChoice, setLoadedChoice] = useState<{
    targetText: string
    choice: RendererChoice
  } | null>(null)

  useEffect(() => {
    if (!selectedId || !groups || cachedChoice) return
    let active = true
    const decide = (choice: RendererChoice) => {
      if (!active) return
      active = false
      window.clearTimeout(timer)
      setLoadedChoice({ targetText, choice })
    }
    const timer = window.setTimeout(
      () =>
        decide({
          kind: 'canvas',
          reason: `shards did not load within ${JAMO_SVG_LOAD_TIMEOUT_MS} ms`,
        }),
      JAMO_SVG_LOAD_TIMEOUT_MS,
    )
    void loadJamoSvgGlyphs(targetSyllables(groups)).then(
      (loaded) => decide(chooseRenderer(groups, loaded)),
      () => decide({ kind: 'canvas', reason: 'the shard loader failed' }),
    )
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [cachedChoice, groups, selectedId, targetText])

  useEffect(() => {
    if (!selectedId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(event.key)) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return
      event.preventDefault()
      const next =
        event.key === 'ArrowLeft' || event.key === 'a' ? index - 1 : index + 1
      if (exercises[next]) onSelect(exercises[next].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [exercises, index, onSelect, selectedId])

  const choice =
    cachedChoice ??
    (loadedChoice?.targetText === targetText ? loadedChoice.choice : undefined)
  const canvasReason = !groups
    ? t('lesson.previewUnsupportedTarget')
    : choice?.kind === 'canvas'
      ? choice.reason
      : null

  return (
    <Modal
      open={Boolean(selectedId && exercise)}
      title={`${t('lesson.previewTitle')} · ${targetText || t('lesson.untitledExercise')}`}
      sizeClassName="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto"
      closeLabel={t('action.close')}
      onClose={onClose}
    >
      {exercise && (
        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#667085]">
              {index + 1} / {exercises.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={index <= 0}
                onClick={() => onSelect(exercises[index - 1].id)}
              >
                {t('action.previousExercise')}
              </Button>
              <Button
                variant="secondary"
                disabled={index >= exercises.length - 1}
                onClick={() => onSelect(exercises[index + 1].id)}
              >
                {t('action.nextExercise')}
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-[#eadfd4] bg-white p-4">
            <div className="flex items-center justify-between gap-2 text-sm">
              <h3 className="font-bold text-[#39465b]">
                {t('lesson.previewPerJamo')}
              </h3>
              <span className="rounded-full bg-[#f1f4fa] px-3 py-1 font-semibold text-[#39465b]">
                {!session
                  ? t('lesson.previewUnavailable')
                  : !groups || choice?.kind === 'canvas'
                    ? 'Canvas'
                    : choice?.kind === 'svg'
                      ? 'SVG'
                      : t('lesson.previewLoading')}
              </span>
            </div>
            {session ? (
              choice?.kind === 'svg' ? (
                <div
                  role="img"
                  aria-label={targetText}
                  className="mt-4 flex max-h-[60vh] flex-wrap justify-center gap-2 overflow-auto"
                >
                  <TargetWords
                    items={Array.from(targetText).map((syllable, position) => ({
                      syllable,
                      position,
                    }))}
                    isSpace={({ syllable }) => syllable === ' '}
                    size="regular"
                    renderTile={({ syllable, position }) => {
                      if (syllable === ' ')
                        return <span key={position} className="w-8" />
                      const glyph = choice.glyphs.get(syllable)
                      if (!glyph) return null
                      return (
                        <svg
                          key={position}
                          data-syllable={syllable}
                          viewBox={`0 0 ${glyph.width} ${choice.unitsPerEm}`}
                          className="h-26 w-26 rounded-md border border-[#f0eaff] bg-[#f9f8ff] p-1.5"
                          aria-hidden="true"
                        >
                          {glyph.paths.map((path, step) => (
                            <path
                              key={step}
                              d={path.d}
                              fillRule="evenodd"
                              fill={STEP_COLORS[step % STEP_COLORS.length]}
                            />
                          ))}
                        </svg>
                      )
                    }}
                  />
                </div>
              ) : canvasReason ? (
                <div className="mt-4 grid justify-items-center gap-3">
                  <DecomposedHangulTarget session={session} size="compact" />
                  <p className="text-center text-xs text-[#667085]">
                    {canvasReason}
                  </p>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-[#667085]">
                  {t('lesson.previewLoading')}
                </p>
              )
            ) : (
              <p className="py-12 text-center text-sm text-[#667085]">
                {t('lesson.previewUnsupportedTarget')}
              </p>
            )}
          </div>
          {session && choice?.kind === 'svg' && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#667085]">
              {session.expectedKeys.map((key, step) =>
                key.jamo === ' ' ? null : (
                  <span key={step} className="flex items-center gap-1">
                    <span
                      className="size-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          STEP_COLORS[
                            session.expectedKeys
                              .slice(0, step)
                              .filter(
                                (candidate) =>
                                  candidate.syllableIndex === key.syllableIndex,
                              ).length % STEP_COLORS.length
                          ],
                      }}
                    />
                    {key.jamo}
                  </span>
                ),
              )}
            </div>
          )}
          <p className="text-xs text-[#667085]">
            {t('lesson.previewShortcuts')}
          </p>
        </div>
      )}
    </Modal>
  )
}
