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
export function commandCoverage(contour: CachedContour, pieces: SplitPiece[]) {
  return contour.commands.map((_, index) =>
    pieces.reduce(
      (count, piece) =>
        count +
        piece.tokens.filter(
          (token) =>
            token.kind === 'source-range' &&
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

/** Preview-only compiler: it can replay nothing except cached source commands and declared anchors. */
export function compileSplitPiecePreview(
  contour: CachedContour,
  piece: SplitPiece,
) {
  const commands: OutlineCommand[] = []
  for (const [tokenIndex, token] of piece.tokens.entries()) {
    if (token.kind === 'source-range') {
      const firstCommand = contour.commands[token.fromCommand]
      const previousToken = piece.tokens[tokenIndex - 1]
      const hasExplicitCursor =
        previousToken?.kind === 'move-to-anchor' ||
        previousToken?.kind === 'line-to-anchor'
      if (
        firstCommand?.type !== 'M' &&
        commands.at(-1)?.type !== 'M' &&
        !hasExplicitCursor
      ) {
        const cursor = cursorBeforeCommand(contour, token.fromCommand)
        if (!cursor)
          throw new Error('Source range has no recoverable start point.')
        commands.push({ type: 'M', x: cursor.x, y: cursor.y })
      }
      commands.push(
        ...contour.commands.slice(token.fromCommand, token.toCommand + 1),
      )
      continue
    }
    if (token.kind === 'close-to-start') {
      commands.push({ type: 'Z' })
      continue
    }
    if (token.anchor.contourId !== contour.id)
      throw new Error('Selected anchor is outside this contour.')
    const { x, y } = anchorCommand(
      contour,
      token.anchor.commandIndex,
      token.anchor.point,
    )
    commands.push({ type: token.kind === 'move-to-anchor' ? 'M' : 'L', x, y })
  }
  if (!commands.some((command) => command.type === 'M'))
    throw new Error('Add a source range beginning with M or a move-to-anchor.')
  return commands.map(commandToSvg).join(' ')
}
