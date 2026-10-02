import type {
  CachedContour,
  OutlineCommand,
  RecipeToken,
  SplitPiece,
} from './types'

function commandToSvg(command: OutlineCommand): string {
  if (command.type === 'Z') return 'Z'
  if (command.type === 'M' || command.type === 'L')
    return `${command.type}${command.x} ${command.y}`
  if (command.type === 'Q')
    return `Q${command.x1} ${command.y1} ${command.x} ${command.y}`
  return `C${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`
}

function anchorCommand(
  contour: CachedContour,
  commandIndex: number,
  point: 'start' | 'end' | 'control1' | 'control2',
) {
  const command = contour.commands[commandIndex]
  const x =
    point === 'control1'
      ? command?.x1
      : point === 'control2'
        ? command?.x2
        : command?.x
  const y =
    point === 'control1'
      ? command?.y1
      : point === 'control2'
        ? command?.y2
        : command?.y
  if (x === undefined || y === undefined)
    throw new Error('Selected anchor has no drawable point.')
  return { x, y }
}

/** Only source ranges consume source geometry; anchors and seams are synthetic path controls. */
export function commandCoverage(
  contour: CachedContour,
  pieces: SplitPiece[],
  sourceContourId = contour.id,
) {
  return contour.commands.map((_, index) =>
    pieces.reduce(
      (count, piece) =>
        count +
        piece.tokens.filter(
          (token) =>
            token.kind === 'source-range' &&
            (token.contourId ?? sourceContourId) === contour.id &&
            index >= token.fromCommand &&
            index <= token.toCommand,
        ).length,
      0,
    ),
  )
}

function cursorBeforeCommand(contour: CachedContour, commandIndex: number) {
  let cursor: { x: number; y: number } | undefined
  let subpathStart: { x: number; y: number } | undefined
  for (let index = 0; index < commandIndex; index += 1) {
    const command = contour.commands[index]
    if (!command) break
    if (command.type === 'M') {
      cursor = { x: command.x!, y: command.y! }
      subpathStart = cursor
    } else if (command.type === 'Z') {
      cursor = subpathStart
    } else {
      cursor = { x: command.x!, y: command.y! }
    }
  }
  return cursor
}

/** Replaces the primary paintable range without losing seam or extra-range tokens. */
export function replacePrimarySourceRange(
  tokens: RecipeToken[],
  fromCommand: number,
  toCommand: number,
): RecipeToken[] {
  const rangeIndex = tokens.findIndex((token) => token.kind === 'source-range')
  const range: RecipeToken = {
    kind: 'source-range',
    fromCommand: Math.min(fromCommand, toCommand),
    toCommand: Math.max(fromCommand, toCommand),
  }
  if (rangeIndex < 0) return [range, ...tokens]
  return tokens.map((token, index) => (index === rangeIndex ? range : token))
}

/** Removes one explicit source range while retaining every other recipe token. */
export function removeSourceRange(tokens: RecipeToken[], tokenIndex: number) {
  const token = tokens[tokenIndex]
  if (!token || token.kind !== 'source-range') return tokens
  return tokens.filter((_, index) => index !== tokenIndex)
}

type SourceRangeToken = Extract<RecipeToken, { kind: 'source-range' }>

/** Splits a piece into its ranges and optional trailing close, if it holds only ranges and line seams. */
function rangesOf(tokens: RecipeToken[]) {
  const closing =
    tokens.at(-1)?.kind === 'close-to-start' ? tokens.at(-1) : undefined
  const body = closing ? tokens.slice(0, -1) : tokens
  if (
    body.some(
      (token) =>
        token.kind !== 'source-range' && token.kind !== 'line-to-anchor',
    )
  )
    return undefined
  return {
    ranges: body.filter(
      (token): token is SourceRangeToken => token.kind === 'source-range',
    ),
    closing,
  }
}

function joinRanges(
  ranges: SourceRangeToken[],
  closing: RecipeToken | undefined,
  sourceContourId: number,
): RecipeToken[] {
  const rebuilt = ranges.flatMap((range, index): RecipeToken[] =>
    index === 0 || range.fromCommand === 0
      ? [range]
      : [
          {
            kind: 'line-to-anchor',
            anchor: {
              contourId: range.contourId ?? sourceContourId,
              commandIndex: range.fromCommand - 1,
              point: 'end',
            },
            reason: 'interior-closure-seam',
          },
          range,
        ],
  )
  return closing ? [...rebuilt, closing] : rebuilt
}

/**
 * Rebuilds the seams between a piece's ranges: each range after the first is
 * preceded by a line seam to the end of the command before it, on its own
 * contour, unless it starts at command 0. A trailing close-to-start seam stays
 * last. Pieces with other tokens (move anchors, mid-piece closes) are returned
 * unchanged.
 */
export function withDefaultSeams(
  tokens: RecipeToken[],
  sourceContourId: number,
): RecipeToken[] {
  const parts = rangesOf(tokens)
  return parts
    ? joinRanges(parts.ranges, parts.closing, sourceContourId)
    : tokens
}

/** Moves one source range up (-1) or down (+1) and rebuilds the seams as `withDefaultSeams` does. */
export function moveSourceRange(
  tokens: RecipeToken[],
  tokenIndex: number,
  direction: -1 | 1,
  sourceContourId: number,
): RecipeToken[] {
  const parts = rangesOf(tokens)
  if (!parts) return tokens
  const position = parts.ranges.indexOf(tokens[tokenIndex] as SourceRangeToken)
  const target = position + direction
  if (position < 0 || target < 0 || target >= parts.ranges.length) return tokens
  const moved = [...parts.ranges]
  ;[moved[position], moved[target]] = [moved[target], moved[position]]
  return joinRanges(moved, parts.closing, sourceContourId)
}

/** Preview-only compiler: it can replay nothing except cached source commands and declared anchors. */
export function compileSplitPiecePreview(
  contour: CachedContour,
  piece: SplitPiece,
  counters: CachedContour[] = [],
) {
  const contourOf = (id = contour.id) =>
    id === contour.id ? contour : counters.find((counter) => counter.id === id)
  const commands: OutlineCommand[] = []
  for (const [tokenIndex, token] of piece.tokens.entries()) {
    if (token.kind === 'source-range') {
      const target = contourOf(token.contourId)
      if (!target)
        throw new Error(
          'Source range is on a contour this recipe does not declare.',
        )
      const firstCommand = target.commands[token.fromCommand]
      const previousToken = piece.tokens[tokenIndex - 1]
      const hasExplicitCursor =
        previousToken?.kind === 'move-to-anchor' ||
        previousToken?.kind === 'line-to-anchor'
      if (
        firstCommand?.type !== 'M' &&
        commands.at(-1)?.type !== 'M' &&
        !hasExplicitCursor
      ) {
        const cursor = cursorBeforeCommand(target, token.fromCommand)
        if (!cursor)
          throw new Error('Source range has no recoverable start point.')
        commands.push({ type: 'M', x: cursor.x, y: cursor.y })
      }
      commands.push(
        ...target.commands.slice(token.fromCommand, token.toCommand + 1),
      )
      continue
    }
    if (token.kind === 'close-to-start') {
      commands.push({ type: 'Z' })
      continue
    }
    const target = contourOf(token.anchor.contourId)
    if (!target)
      throw new Error("Selected anchor is outside this recipe's contours.")
    const { x, y } = anchorCommand(
      target,
      token.anchor.commandIndex,
      token.anchor.point,
    )
    commands.push({
      type:
        token.kind === 'move-to-anchor' || commands.length === 0 ? 'M' : 'L',
      x,
      y,
    })
  }
  if (!commands.some((command) => command.type === 'M'))
    throw new Error('Add a source range beginning with M or a move-to-anchor.')
  return commands.map(commandToSvg).join(' ')
}

type PieceRef = { kind: 'split-piece'; recipeId: string; pieceId: string }
type StepLike = {
  order: number
  jamo: string
  geometry: Array<PieceRef | { kind: 'contour'; contourId: number }>
}

/**
 * Gives one split piece to `step` (or to no step when null). For a two-piece
 * recipe whose other piece is still unassigned, that piece also goes to the
 * only other step that has no geometry yet (any other step, in a two-step
 * glyph), so splitting one contour between two jamo takes one choice.
 */
export function assignPiece<T extends StepLike>(
  steps: T[],
  recipe: { id: string; pieces: Array<{ id: string }> },
  pieceId: string,
  step: number | null,
): T[] {
  const place = (items: T[], id: string, order: number | null) =>
    items.map((item) => ({
      ...item,
      geometry: [
        ...item.geometry.filter(
          (ref) =>
            ref.kind !== 'split-piece' ||
            ref.recipeId !== recipe.id ||
            ref.pieceId !== id,
        ),
        ...(item.order === order
          ? [{ kind: 'split-piece' as const, recipeId: recipe.id, pieceId: id }]
          : []),
      ],
    }))
  const next = place(steps, pieceId, step)
  const partner =
    recipe.pieces.length === 2
      ? recipe.pieces.find(({ id }) => id !== pieceId)
      : undefined
  if (step === null || !partner) return next
  const owned = next.some((item) =>
    item.geometry.some(
      (ref) =>
        ref.kind === 'split-piece' &&
        ref.recipeId === recipe.id &&
        ref.pieceId === partner.id,
    ),
  )
  const candidates = next.filter(
    (item) =>
      item.order !== step && (next.length === 2 || item.geometry.length === 0),
  )
  return !owned && candidates.length === 1
    ? place(next, partner.id, candidates[0].order)
    : next
}
