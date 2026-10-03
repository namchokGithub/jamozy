import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { shardFileName } from '../../src/domain/korean/hangul'
import { compileRuntimeShards } from './runtime-dataset'

// Guards the committed runtime shards: approving a review without running
// `pnpm jamo-svg:compile-runtime` fails here.
test('committed runtime shards match the approved reviews', async () => {
  const texts = await compileRuntimeShards(
    'tools/jamo-svg/reviews/pretendard-600',
  )
  const committed = await Promise.all(
    texts.map((_, index) =>
      readFile(
        join('public/jamo-svg/pretendard-600', shardFileName(index)),
        'utf8',
      ).catch(() => ''),
    ),
  )
  const stale = texts.flatMap((text, index) =>
    text === committed[index] ? [] : [shardFileName(index)],
  )
  expect(stale, 'Run pnpm jamo-svg:compile-runtime').toEqual([])
}, 180_000)
