import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  loadJamoSvgGlyphs,
  resetJamoSvgDatasetCacheForTests,
} from './jamo-svg-dataset'

const glyph = {
  width: 1770,
  paths: [
    { jamo: 'ㄱ', d: 'M0 0' },
    { jamo: 'ㅏ', d: 'M1 1' },
  ],
}
const shard = (glyphs: object, overrides: object = {}) => ({
  datasetSchemaVersion: 1,
  fontSha256: 'f',
  unitsPerEm: 2048,
  glyphs,
  ...overrides,
})
const respond = (body: unknown, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 404,
    json: () => Promise.resolve(body),
  })

beforeEach(() => {
  resetJamoSvgDatasetCacheForTests()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('fetches one shard for syllables that share a choseong', async () => {
  const fetchMock = vi.fn(() => respond(shard({ 가: glyph, 거: glyph })))
  vi.stubGlobal('fetch', fetchMock)
  const loaded = await loadJamoSvgGlyphs(['가', '거', '가'])
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith('/jamo-svg/pretendard-600/00.json')
  expect(loaded?.unitsPerEm).toBe(2048)
  expect([...(loaded?.glyphs.keys() ?? [])]).toEqual(['가', '거'])
})

test('shares one request between concurrent and later calls', async () => {
  const fetchMock = vi.fn(() => respond(shard({ 가: glyph })))
  vi.stubGlobal('fetch', fetchMock)
  await Promise.all([loadJamoSvgGlyphs(['가']), loadJamoSvgGlyphs(['가'])])
  await loadJamoSvgGlyphs(['가'])
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('does not cache a failed shard, so a later call retries', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() => respond({}, false))
    .mockImplementation(() => respond(shard({ 가: glyph })))
  vi.stubGlobal('fetch', fetchMock)
  expect(await loadJamoSvgGlyphs(['가'])).toBeUndefined()
  expect((await loadJamoSvgGlyphs(['가']))?.glyphs.has('가')).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('rejects an unsupported schema version', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => respond(shard({ 가: glyph }, { datasetSchemaVersion: 2 }))),
  )
  expect(await loadJamoSvgGlyphs(['가'])).toBeUndefined()
})

test('rejects shards built from different fonts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      respond(
        url.endsWith('00.json')
          ? shard({ 가: glyph })
          : shard({ 나: glyph }, { fontSha256: 'other' }),
      ),
    ),
  )
  expect(await loadJamoSvgGlyphs(['가', '나'])).toBeUndefined()
})

test('leaves syllables without approved data out of the result', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => respond(shard({ 가: glyph }))),
  )
  const loaded = await loadJamoSvgGlyphs(['가', '거'])
  expect([...(loaded?.glyphs.keys() ?? [])]).toEqual(['가'])
})

test('returns undefined without fetching for non-syllables', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  expect(await loadJamoSvgGlyphs(['가', ' '])).toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('rejects a shard whose glyphs are missing', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => respond({ ...shard({}), glyphs: null })),
  )
  expect(await loadJamoSvgGlyphs(['가'])).toBeUndefined()
})
