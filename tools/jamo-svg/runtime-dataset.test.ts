import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { extractGlyph } from './extract'
import type { ReviewManifest, ReviewShard } from './review-store'
import {
  buildRuntimeShards,
  roundPathNumbers,
  serializeRuntimeShard,
  type ApprovedEntry,
} from './runtime-dataset'
import type { GlyphReview } from './types'

const reviewsRoot = 'tools/jamo-svg/reviews/pretendard-600'
const META = { fontSha256: 'f', unitsPerEm: 2048 }

async function committedReview(syllable: string): Promise<GlyphReview> {
  const manifest = JSON.parse(
    await readFile(join(reviewsRoot, 'manifest.json'), 'utf8'),
  ) as ReviewManifest
  for (const item of manifest.shards) {
    const shard = JSON.parse(
      await readFile(join(reviewsRoot, item.file), 'utf8'),
    ) as ReviewShard
    if (shard.reviews[syllable]) return structuredClone(shard.reviews[syllable])
  }
  throw new Error(`No committed review for ${syllable}.`)
}
const entry = async (
  syllable: string,
  status: GlyphReview['status'] = 'approved',
): Promise<ApprovedEntry> => ({
  glyph: await extractGlyph(syllable),
  review: { ...(await committedReview(syllable)), status },
})

describe('runtime dataset compiler', () => {
  test('compiles only approved reviews into 19 choseong shards sorted by code point', async () => {
    const shards = buildRuntimeShards(
      [
        await entry('거'),
        await entry('나'),
        await entry('가'),
        await entry('카', 'reviewing'),
      ],
      META,
    )
    expect(shards).toHaveLength(19)
    expect(Object.keys(shards[0].glyphs)).toEqual(['가', '거'])
    expect(Object.keys(shards[2].glyphs)).toEqual(['나'])
    expect(shards[15].glyphs).toEqual({})
    expect(shards[0]).toMatchObject({
      datasetSchemaVersion: 1,
      fontSha256: 'f',
      unitsPerEm: 2048,
    })
  })

  test('keeps the minimal glyph shape with one path per typed key', async () => {
    const [shard] = buildRuntimeShards([await entry('가')], META)
    const glyph = shard.glyphs['가']
    expect(Object.keys(glyph)).toEqual(['width', 'paths'])
    expect(glyph.width).toBe(1770)
    expect(glyph.paths.map(({ jamo }) => jamo)).toEqual(['ㄱ', 'ㅏ'])
    expect(glyph.paths.every(({ d }) => d.startsWith('M'))).toBe(true)
  })

  test('rounds path numbers to one decimal place', () => {
    expect(roundPathNumbers('M1.26 -0.04 Q468.5 568.56 10 2')).toBe(
      'M1.3 0 Q468.5 568.6 10 2',
    )
  })

  test('stops when an approved review fails validation', async () => {
    const broken = await entry('가')
    broken.review.steps[1].geometry = []
    expect(() => buildRuntimeShards([broken], META)).toThrow(
      /가 is approved but fails validation/,
    )
  })

  test('serializes deterministically with one glyph per line', async () => {
    const forward = buildRuntimeShards(
      [await entry('가'), await entry('거')],
      META,
    )
    const backward = buildRuntimeShards(
      [await entry('거'), await entry('가')],
      META,
    )
    const text = serializeRuntimeShard(forward[0])
    expect(text).toBe(serializeRuntimeShard(backward[0]))
    expect(JSON.parse(text)).toEqual(forward[0])
    expect(
      text.split('\n').filter((line) => line.startsWith('    "')),
    ).toHaveLength(2)
    expect(serializeRuntimeShard(forward[5])).toBe(
      '{\n  "datasetSchemaVersion": 1,\n  "fontSha256": "f",\n  "unitsPerEm": 2048,\n  "glyphs": {}\n}\n',
    )
  })
})
