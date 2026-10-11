import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Lesson, LessonExercise } from '../../domain/models/lesson'
import { loadJamoSvgGlyphs } from '../../infrastructure/jamo-svg/jamo-svg-dataset'
import { ExercisePreviewModal } from './ExercisePreviewModal'
import LessonEditorPage from './LessonEditorPage'

vi.mock('./AdminSortableList', () => ({
  AdminSortableList: ({
    items,
    renderItem,
  }: {
    items: LessonExercise[]
    renderItem: (
      item: LessonExercise,
      props: { handleRef: () => void; isDragging: boolean; ref: () => void },
    ) => ReactNode
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.id}>
          {renderItem(item, {
            handleRef: () => undefined,
            isDragging: false,
            ref: () => undefined,
          })}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../../infrastructure/jamo-svg/jamo-svg-dataset', () => ({
  loadJamoSvgGlyphs: vi.fn(),
  peekJamoSvgGlyphs: vi.fn(() => undefined),
}))
vi.mock('../typing/DecomposedHangulTarget', () => ({
  default: ({ session }: { session: { targetText: string } }) => (
    <div role="img" aria-label={session.targetText} />
  ),
}))

beforeEach(() => {
  vi.mocked(loadJamoSvgGlyphs).mockReset()
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(undefined)
})

function exercise(
  id: string,
  targetText: string,
  romanization: string | null = null,
): LessonExercise {
  return {
    id,
    targetText,
    romanization,
    meaningTh: '',
    meaningEn: '',
    difficulty: 'easy',
    hint: null,
  }
}

const lesson: Lesson = {
  id: 'lesson-1',
  unitId: 'unit-1',
  title: 'Preview lesson',
  type: 'character',
  order: 0,
  status: 'draft',
  exercises: [
    exercise('one', '가'),
    exercise('two', '나'),
    exercise('three', '다'),
  ],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

test('Preview opens the selected exercise and arrow or a/d keys navigate visible exercises', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: LessonEditorPage,
        loader: () => ({ lesson, unit: null, course: null }),
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)

  await screen.findByPlaceholderText(
    'Search text, romanization, or translation',
  )
  const previewButtons = screen.getAllByRole('button', { name: 'Preview' })
  fireEvent.click(previewButtons[1])

  const dialog = screen.getByRole('dialog', { name: /나/ })
  expect(within(dialog).getByText('2 / 3')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(within(dialog).getByText('3 / 3')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'd' })
  expect(within(dialog).getByText('3 / 3')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'a' })
  expect(within(dialog).getByText('2 / 3')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  expect(within(dialog).getByText('1 / 3')).toBeInTheDocument()
})

test('Preview navigation follows the visible filtered exercises', async () => {
  const filteredLesson = {
    ...lesson,
    exercises: [
      exercise('one', '가', 'match'),
      exercise('two', '나', 'other'),
      exercise('three', '다', 'match'),
    ],
  }
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: LessonEditorPage,
        loader: () => ({ lesson: filteredLesson, unit: null, course: null }),
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)

  const search = await screen.findByPlaceholderText(
    'Search text, romanization, or translation',
  )
  fireEvent.change(search, { target: { value: 'match' } })
  expect(screen.getAllByRole('button', { name: 'Preview' })).toHaveLength(2)
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0])
  const dialog = screen.getByRole('dialog', { name: /가/ })
  fireEvent.keyDown(window, { key: 'd' })
  expect(within(dialog).getByText('2 / 2')).toBeInTheDocument()
  expect(dialog).toHaveAccessibleName(/다/)
  search.focus()
  fireEvent.keyDown(search, { key: 'a' })
  expect(within(dialog).getByText('2 / 2')).toBeInTheDocument()
})

test('Preview reads the unsaved target text from the exercise editor', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: LessonEditorPage,
        loader: () => ({ lesson, unit: null, course: null }),
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)

  await screen.findByPlaceholderText(
    'Search text, romanization, or translation',
  )
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit exercise' })[0])
  fireEvent.change(screen.getByRole('textbox', { name: 'Target text' }), {
    target: { value: 'ㅝ' },
  })
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0])
  expect(screen.getByRole('dialog', { name: /ㅝ/ })).toHaveTextContent('Canvas')
})

test('preview colors approved SVG steps and uses Canvas for standalone vowels', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue({
    unitsPerEm: 2048,
    glyphs: new Map([
      [
        '둬',
        {
          width: 1770,
          paths: [
            { jamo: 'ㄷ', d: 'M0 0' },
            { jamo: 'ㅜ', d: 'M1 0' },
            { jamo: 'ㅓ', d: 'M2 0' },
          ],
        },
      ],
    ]),
  })
  const items = [exercise('one', '둬'), exercise('two', 'ㅝ')]
  const onSelect = vi.fn()
  const { rerender } = render(
    <ExercisePreviewModal
      exercises={items}
      selectedId="one"
      onSelect={onSelect}
      onClose={() => undefined}
    />,
  )
  const svg = await screen.findByRole('img', { name: '둬' })
  expect(
    [...svg.querySelectorAll('path')].map((path) => path.getAttribute('fill')),
  ).toEqual(['#e66c58', '#4c8f8b', '#7866b8'])
  rerender(
    <ExercisePreviewModal
      exercises={items}
      selectedId="two"
      onSelect={onSelect}
      onClose={() => undefined}
    />,
  )
  expect(screen.getByRole('dialog', { name: /ㅝ/ })).toHaveTextContent('Canvas')
  expect(loadJamoSvgGlyphs).toHaveBeenCalledTimes(1)
})
