import { join } from 'node:path'
import {
  compileRuntimeShards,
  writeRuntimeShards,
} from '../tools/jamo-svg/runtime-dataset'

// Compiles approved reviews into the runtime shards the app fetches (DEC-039).
// Every shard is compiled, then staged, before any file is replaced, so a
// failure leaves the previous set intact.
const root = process.cwd()
const outDir = join(root, 'public/jamo-svg/pretendard-600')
const texts = await compileRuntimeShards(
  join(root, 'tools/jamo-svg/reviews/pretendard-600'),
)
await writeRuntimeShards(outDir, texts)
const glyphCount = texts.reduce(
  (sum, text) =>
    sum + Object.keys((JSON.parse(text) as { glyphs: object }).glyphs).length,
  0,
)
console.log(
  `Wrote ${texts.length} shards with ${glyphCount} glyphs to public/jamo-svg/pretendard-600.`,
)
