import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { auditReviews } from '../tools/jamo-svg/audit'
import { extractGlyph } from '../tools/jamo-svg/extract'
import type { ApprovedTemplate } from '../tools/jamo-svg/propose'
import type {
  ReviewManifest,
  ReviewShard,
} from '../tools/jamo-svg/review-store'

// Read-only audit of approved reviews for mistakes validation cannot see.
// Exits with status 1 when any finding is reported.
const reviewsRoot = join(process.cwd(), 'tools/jamo-svg/reviews/pretendard-600')
const manifest = JSON.parse(
  await readFile(join(reviewsRoot, 'manifest.json'), 'utf8'),
) as ReviewManifest
const approved: ApprovedTemplate[] = []
for (const { file } of manifest.shards) {
  const shard = JSON.parse(
    await readFile(join(reviewsRoot, file), 'utf8'),
  ) as ReviewShard
  for (const [syllable, review] of Object.entries(shard.reviews))
    if (review.status === 'approved')
      approved.push({ glyph: await extractGlyph(syllable), review })
}
const findings = auditReviews(approved)
const labels = {
  validation: 'Validation blocker',
  position: 'Jamo on the wrong side',
  'tiny-step': 'Sliver step',
  'similar-glyph': 'Differs from a similar glyph',
} as const
for (const check of Object.keys(labels) as Array<keyof typeof labels>) {
  const rows = findings.filter((finding) => finding.check === check)
  console.log(`${rows.length ? '✗' : '✓'} ${labels[check]}: ${rows.length}`)
  for (const { syllable, detail } of rows)
    console.log(`    ${syllable}  ${detail}`)
}
console.log(
  `${approved.length} approved reviews audited; ${findings.length} findings.`,
)
if (findings.length) process.exitCode = 1
