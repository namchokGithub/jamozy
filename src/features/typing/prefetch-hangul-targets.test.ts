import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadJamoSvgGlyphs = vi.fn<(syllables: string[]) => Promise<undefined>>(
  async () => undefined,
)
let enabled = true
vi.mock('../../infrastructure/jamo-svg/jamo-svg-dataset', () => ({
  loadJamoSvgGlyphs: (syllables: string[]) => loadJamoSvgGlyphs(syllables),
}))
vi.mock('./jamo-svg-flag', () => ({ isJamoSvgRendererEnabled: () => enabled }))

const { prefetchHangulTargets } = await import('./prefetch-hangul-targets')

describe('prefetchHangulTargets', () => {
  beforeEach(() => {
    loadJamoSvgGlyphs.mockClear()
    enabled = true
  })

  it('loads the shards for every Hangul syllable once', () => {
    prefetchHangulTargets(['가나', '나다'])

    expect(loadJamoSvgGlyphs).toHaveBeenCalledOnce()
    expect(loadJamoSvgGlyphs).toHaveBeenCalledWith(['가', '나', '다'])
  })

  it('skips text the SVG renderer does not draw', () => {
    prefetchHangulTargets(['ㄱ', 'abc', 'ᄀ'])

    expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
  })

  it('does nothing when the SVG renderer is off', () => {
    enabled = false
    prefetchHangulTargets(['가'])

    expect(loadJamoSvgGlyphs).not.toHaveBeenCalled()
  })
})
