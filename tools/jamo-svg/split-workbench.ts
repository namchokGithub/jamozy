import type { CachedContour, OutlineCommand, SplitPiece } from './types'

function commandToSvg(command: OutlineCommand): string {
  if (command.type === 'Z') return 'Z'
  if (command.type === 'M' || command.type === 'L') return `${command.type}${command.x} ${command.y}`
  if (command.type === 'Q') return `Q${command.x1} ${command.y1} ${command.x} ${command.y}`
  return `C${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`
}

function anchorCommand(contour: CachedContour, commandIndex: number, point: 'start' | 'end' | 'control1' | 'control2') {
  const command = contour.commands[commandIndex]
  const x = point === 'control1' ? command?.x1 : point === 'control2' ? command?.x2 : command?.x
  const y = point === 'control1' ? command?.y1 : point === 'control2' ? command?.y2 : command?.y
  if (x === undefined || y === undefined) throw new Error('Selected anchor has no drawable point.')
  return { x, y }
}

/** Source geometry is consumed by ranges and move anchors; closure seams are synthetic. */
export function commandCoverage(contour: CachedContour, pieces: SplitPiece[]) {
  return contour.commands.map((_, index) => pieces.reduce((count, piece) => count + piece.tokens.filter((token) =>
    (token.kind === 'source-range' && index >= token.fromCommand && index <= token.toCommand)
    || (token.kind === 'move-to-anchor' && token.anchor.commandIndex === index),
  ).length, 0))
}

/** Preview-only compiler: it can replay nothing except cached source commands and declared anchors. */
export function compileSplitPiecePreview(contour: CachedContour, piece: SplitPiece) {
  const commands: OutlineCommand[] = []
  for (const token of piece.tokens) {
    if (token.kind === 'source-range') {
      commands.push(...contour.commands.slice(token.fromCommand, token.toCommand + 1))
      continue
    }
    if (token.kind === 'close-to-start') {
      commands.push({ type: 'Z' })
      continue
    }
    if (token.anchor.contourId !== contour.id) throw new Error('Selected anchor is outside this contour.')
    const { x, y } = anchorCommand(contour, token.anchor.commandIndex, token.anchor.point)
    commands.push({ type: token.kind === 'move-to-anchor' ? 'M' : 'L', x, y })
  }
  if (!commands.some((command) => command.type === 'M')) throw new Error('Add a source range beginning with M or a move-to-anchor.')
  return commands.map(commandToSvg).join(' ')
}
