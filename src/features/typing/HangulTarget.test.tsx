import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  pressKey,
  startTypingSession,
} from '../../domain/korean/typing-session'
import {
  loadJamoSvgGlyphs,
  peekJamoSvgGlyphs,
} from '../../infrastructure/jamo-svg/jamo-svg-dataset'
import HangulTarget, { JAMO_SVG_LOAD_TIMEOUT_MS } from './HangulTarget'
import { isJamoSvgRendererEnabled } from './jamo-svg-flag'

vi.mock('./jamo-svg-flag', () => ({ isJamoSvgRendererEnabled: vi.fn() }))
vi.mock('../../infrastructure/jamo-svg/jamo-svg-dataset', () => ({
  loadJamoSvgGlyphs: vi.fn(),
  peekJamoSvgGlyphs: vi.fn(),
}))
vi.mock('./DecomposedHangulTarget', () => ({
  default: () => <div data-testid="canvas-target" />,
}))

const glyph = (...jamo: string[]) => ({
  width: 1770,
  paths: jamo.map((value, index) => ({ jamo: value, d: `M${index} 0` })),
})
const loaded = (entries: Record<string, ReturnType<typeof glyph>>) => ({
  unitsPerEm: 2048,
  glyphs: new Map(Object.entries(entries)),
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}
const fills = (container: HTMLElement) =>
  [...container.querySelectorAll('path')].map((path) =>
    path.getAttribute('fill'),
  )

beforeEach(() => {
  vi.mocked(isJamoSvgRendererEnabled).mockReturnValue(true)
  vi.mocked(peekJamoSvgGlyphs).mockReturnValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

test('flag off renders Canvas without loading data', () => {
  vi.mocked(isJamoSvgRendererEnabled).mockReturnValue(false)
  render(<HangulTarget session={startTypingSession('가')} />)
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
})

test('shows blank tiles, then SVG whose step fills follow keyIndex', async () => {
  const request = deferred<ReturnType<typeof loaded>>()
  vi.mocked(loadJamoSvgGlyphs).mockReturnValue(request.promise)
  const session = startTypingSession('가나')
  const { container, rerender } = render(<HangulTarget session={session} />)
  expect(screen.getAllByTestId('pending-hangul-tile')).toHaveLength(2)
  await act(async () =>
    request.resolve(loaded({ 가: glyph('ㄱ', 'ㅏ'), 나: glyph('ㄴ', 'ㅏ') })),
  )
  expect(container.querySelectorAll('svg')).toHaveLength(2)
  expect(fills(container)).toEqual(['#e990b6', '#c7c3bc', '#c7c3bc', '#c7c3bc'])
  rerender(<HangulTarget session={pressKey(session, 'KeyR', false)} />)
  expect(fills(container)).toEqual(['#20b981', '#e990b6', '#c7c3bc', '#c7c3bc'])
  expect(loadJamoSvgGlyphs).toHaveBeenCalledTimes(1)
})

test('a completed session shows every step as correct', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(
    loaded({ 가: glyph('ㄱ', 'ㅏ') }),
  )
  let session = startTypingSession('가')
  session = pressKey(pressKey(session, 'KeyR', false), 'KeyK', false)
  const { container } = render(<HangulTarget session={session} />)
  await act(async () => {})
  expect(fills(container)).toEqual(['#20b981', '#20b981'])
})

test('one missing syllable renders Canvas for the whole target', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(
    loaded({ 가: glyph('ㄱ', 'ㅏ') }),
  )
  render(<HangulTarget session={startTypingSession('가나')} />)
  expect(await screen.findByTestId('canvas-target')).toBeInTheDocument()
})

test('a standalone jamo renders Canvas without loading data', () => {
  render(<HangulTarget session={startTypingSession('ㄱ')} />)
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
})

test('a target with a space renders Canvas (literal key)', () => {
  render(<HangulTarget session={startTypingSession('가 나')} />)
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
})

test('a step mismatch renders Canvas', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(
    loaded({ 가: glyph('ㄱ', 'ㅓ') }),
  )
  render(<HangulTarget session={startTypingSession('가')} />)
  expect(await screen.findByTestId('canvas-target')).toBeInTheDocument()
})

test('a timeout renders Canvas and keeps it when data arrives later', async () => {
  vi.useFakeTimers()
  const request = deferred<ReturnType<typeof loaded>>()
  vi.mocked(loadJamoSvgGlyphs).mockReturnValue(request.promise)
  const { container } = render(
    <HangulTarget session={startTypingSession('가')} />,
  )
  act(() => vi.advanceTimersByTime(JAMO_SVG_LOAD_TIMEOUT_MS))
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  await act(async () => request.resolve(loaded({ 가: glyph('ㄱ', 'ㅏ') })))
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(container.querySelector('svg')).toBeNull()
})

test('a target change discards the stale result', async () => {
  const first = deferred<ReturnType<typeof loaded>>()
  const second = deferred<ReturnType<typeof loaded>>()
  vi.mocked(loadJamoSvgGlyphs)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
  const { container, rerender } = render(
    <HangulTarget session={startTypingSession('가')} />,
  )
  rerender(<HangulTarget session={startTypingSession('나')} />)
  await act(async () => second.resolve(loaded({ 나: glyph('ㄴ', 'ㅏ') })))
  await act(async () => first.resolve(loaded({ 가: glyph('ㄱ', 'ㅏ') })))
  const svgs = container.querySelectorAll('svg')
  expect(svgs).toHaveLength(1)
  expect(svgs[0].getAttribute('data-syllable')).toBe('나')
})

test('a loader that throws renders Canvas without waiting for the timeout', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockRejectedValue(new Error('boom'))
  render(<HangulTarget session={startTypingSession('가')} />)
  expect(await screen.findByTestId('canvas-target')).toBeInTheDocument()
})

test('a failed shard load renders Canvas', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(undefined)
  render(<HangulTarget session={startTypingSession('가')} />)
  expect(await screen.findByTestId('canvas-target')).toBeInTheDocument()
})

test('SVG paths fill with even-odd, matching the Tagger', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(
    loaded({ 가: glyph('ㄱ', 'ㅏ') }),
  )
  const { container } = render(
    <HangulTarget session={startTypingSession('가')} />,
  )
  await act(async () => {})
  const rules = [...container.querySelectorAll('path')].map((path) =>
    path.getAttribute('fill-rule'),
  )
  expect(rules).toEqual(['evenodd', 'evenodd'])
})

test('cached shards render SVG at once, without blank tiles or a fetch', () => {
  vi.mocked(peekJamoSvgGlyphs).mockReturnValue(
    loaded({ 가: glyph('ㄱ', 'ㅏ') }),
  )
  const { container } = render(
    <HangulTarget session={startTypingSession('가')} />,
  )
  expect(screen.queryByTestId('pending-hangul-tile')).toBeNull()
  expect(container.querySelectorAll('svg')).toHaveLength(1)
  expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
})

test('cached shards without a needed glyph render Canvas at once', () => {
  vi.mocked(peekJamoSvgGlyphs).mockReturnValue(
    loaded({ 가: glyph('ㄱ', 'ㅏ') }),
  )
  render(<HangulTarget session={startTypingSession('가나')} />)
  expect(screen.queryByTestId('pending-hangul-tile')).toBeNull()
  expect(screen.getByTestId('canvas-target')).toBeInTheDocument()
  expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
})

test('selection checks steps against the session’s own expected keys', async () => {
  const base = startTypingSession('가')
  const session = {
    ...base,
    expectedKeys: base.expectedKeys.map((key) =>
      key.jamo === 'ㅏ' ? { ...key, jamo: 'ㅓ' } : key,
    ),
  }
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(
    loaded({ 가: glyph('ㄱ', 'ㅓ') }),
  )
  const { container } = render(<HangulTarget session={session} />)
  await act(async () => {})
  expect(container.querySelectorAll('svg')).toHaveLength(1)
})

test('the same target in the next exercise keeps SVG without blank tiles', async () => {
  vi.mocked(loadJamoSvgGlyphs).mockResolvedValue(
    loaded({ 가: glyph('ㄱ', 'ㅏ') }),
  )
  const finished = pressKey(
    pressKey(startTypingSession('가'), 'KeyR', false),
    'KeyK',
    false,
  )
  const { container, rerender } = render(<HangulTarget session={finished} />)
  await act(async () => {})
  expect(fills(container)).toEqual(['#20b981', '#20b981'])
  rerender(<HangulTarget session={startTypingSession('가')} />)
  expect(screen.queryByTestId('pending-hangul-tile')).toBeNull()
  expect(fills(container)).toEqual(['#e990b6', '#c7c3bc'])
  await act(async () => {})
  expect(container.querySelectorAll('svg')).toHaveLength(1)
  expect(loadJamoSvgGlyphs).toHaveBeenCalledTimes(1)
})
