import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { loadCacheGlyph } from './cache'
import { compileRecipePiece, compileReview, validateReview } from './compile'
import { previewReview } from './preview'
import { QueueStore, ReviewStore } from './review-store'
import { createUnreviewedDraft } from './review-draft'
import type { GlyphReview } from './types'

const ROOT = process.cwd()
const reviewsRoot = join(ROOT, 'tools/jamo-svg/reviews/pretendard-600')
const queueFile = join(ROOT, 'tools/jamo-svg/queue/pretendard-600/queue.json')
function json(response: import('node:http').ServerResponse, status: number, value: unknown) { response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)) }
function piecePreviews(source: Awaited<ReturnType<typeof loadCacheGlyph>>, review: GlyphReview) {
  return review.splitRecipes.flatMap((recipe) => recipe.pieces.map((piece) => {
    try { return { recipeId: recipe.id, pieceId: piece.id, d: compileRecipePiece(source, recipe, piece.id) } }
    catch (error) { return { recipeId: recipe.id, pieceId: piece.id, d: '', error: error instanceof Error ? error.message : 'Invalid piece.' } }
  }))
}

export function jamoSvgTaggerPlugin(): Plugin {
  return {
    name: 'jamo-svg-tagger',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__jamo-svg', async (request, response) => {
        try {
          if (!existsSync(join(reviewsRoot, 'manifest.json')) || !existsSync(queueFile)) return json(response, 503, { error: 'Tagger data is missing. Run pnpm jamo-svg:seed.' })
          const url = new URL(request.url ?? '/', 'http://localhost')
          const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(join(reviewsRoot, 'manifest.json'), 'utf8')) as { activeFontFingerprint: string }
          const cacheRoot = join(ROOT, 'tools/jamo-svg/cache', manifest.activeFontFingerprint)
          const reviews = new ReviewStore(reviewsRoot, cacheRoot); const queue = new QueueStore(queueFile, manifest.activeFontFingerprint)
          if (request.method === 'GET' && url.pathname === '/queue') {
            const entries = await Promise.all((await queue.list()).map(async (entry) => {
              const review = await reviews.get(entry.syllable)
              return { ...entry, reviewStatus: review?.status ?? 'unreviewed', blockers: review?.blockers ?? [] }
            }))
            return json(response, 200, { entries, manifest: await reviews.getManifest() })
          }
          const syllable = url.searchParams.get('syllable')
          if (request.method === 'GET' && url.pathname === '/glyph' && syllable) {
            const source = await loadCacheGlyph(cacheRoot, syllable); const { review: savedReview, revision } = await reviews.getWithRevision(syllable)
            const review = savedReview ?? createUnreviewedDraft(source)
            return json(response, 200, { source, review, revision, ...previewReview(source, review), piecePreviews: piecePreviews(source, review) })
          }
          if (request.method === 'POST' && (url.pathname === '/preview' || url.pathname === '/save' || url.pathname === '/approve')) {
            const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk)); const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { review: GlyphReview; expectedRevision?: string; reviewer?: string }
            const review = body.review
            const source = await loadCacheGlyph(cacheRoot, review.syllable)
            if (url.pathname === '/preview') return json(response, 200, { ...previewReview(source, review), piecePreviews: piecePreviews(source, review) })
            if (url.pathname === '/approve') {
              const validation = validateReview(source, review)
              if (validation.blockers.length) return json(response, 422, { error: 'Cannot approve invalid review.', validation })
              review.status = 'approved'; review.approved = { at: new Date().toISOString(), reviewer: body.reviewer ?? 'local-reviewer', validatorVersion: 1, validationHash: createHash('sha256').update(JSON.stringify({ source: source.sourceGlyphHash, review })).digest('hex') }
            } else if (review.status === 'approved') { review.status = 'reviewing'; delete review.approved }
            const saved = await reviews.save(review, body.expectedRevision)
            return json(response, 200, { review, revision: saved.revision, compiled: compileReview(source, review), validation: validateReview(source, review), piecePreviews: piecePreviews(source, review) })
          }
          return json(response, 404, { error: 'Unknown Jamo SVG Tagger endpoint.' })
        } catch (error) { return json(response, 409, { error: error instanceof Error ? error.message : 'Tagger operation failed.' }) }
      })
    },
  }
}
