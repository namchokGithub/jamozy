import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { shardFileName } from '../../src/domain/korean/hangul'
import {
  compileRuntimeShards,
  STANDALONE_JAMO_SHARD_FILE,
} from './runtime-dataset'

// Guards the committed runtime shards: approving a review without running
// `pnpm jamo-svg:compile-runtime` fails here.
test('committed runtime shards match the approved reviews', async () => {
  const { syllableShards, standaloneJamoShard } = await compileRuntimeShards(
    'tools/jamo-svg/reviews/pretendard-600',
  )
  const committed = await Promise.all(
    syllableShards.map((_, index) =>
      readFile(
        join('public/jamo-svg/pretendard-600', shardFileName(index)),
        'utf8',
      ).catch(() => ''),
    ),
  )
  const stale = syllableShards.flatMap((text, index) =>
    text === committed[index] ? [] : [shardFileName(index)],
  )
  const committedStandalone = await readFile(
    join('public/jamo-svg/pretendard-600', STANDALONE_JAMO_SHARD_FILE),
    'utf8',
  ).catch(() => '')
  if (standaloneJamoShard !== committedStandalone)
    stale.push(STANDALONE_JAMO_SHARD_FILE)
  expect(stale, 'Run pnpm jamo-svg:compile-runtime').toEqual([])
}, 180_000)
