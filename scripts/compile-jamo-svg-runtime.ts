import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { shardFileName } from '../src/domain/korean/hangul'
import { compileRuntimeShards } from '../tools/jamo-svg/runtime-dataset'

// Compiles approved reviews into the runtime shards the app fetches (DEC-039).
// Every shard is compiled before any file is written, so a failure writes nothing.
const root = process.cwd()
const outDir = join(root, 'public/jamo-svg/pretendard-600')
const texts = await compileRuntimeShards(
  join(root, 'tools/jamo-svg/reviews/pretendard-600'),
)
await mkdir(outDir, { recursive: true })
await Promise.all(
  texts.map((text, index) =>
    writeFile(join(outDir, shardFileName(index)), text),
  ),
)
const glyphCount = texts.reduce(
  (sum, text) =>
    sum + Object.keys((JSON.parse(text) as { glyphs: object }).glyphs).length,
  0,
)
console.log(
  `Wrote ${texts.length} shards with ${glyphCount} glyphs to public/jamo-svg/pretendard-600.`,
)
