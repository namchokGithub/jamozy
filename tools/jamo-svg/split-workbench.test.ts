import { expect, test } from 'vitest'
import { commandCoverage, compileSplitPiecePreview } from './split-workbench'

const contour = {
  id: 0,
  d: 'M0 0 L10 0 L10 10 Z',
  commands: [
    { type: 'M' as const, x: 0, y: 0 },
    { type: 'L' as const, x: 10, y: 0 },
    { type: 'L' as const, x: 10, y: 10 },
    { type: 'Z' as const },
  ],
  commandHash: 'contour',
  bounds: { x1: 0, y1: 0, x2: 10, y2: 10 },
  commandTypes: 'MLLZ',
}

test('reports exact, uncovered, and duplicate source-command ownership', () => {
  expect(commandCoverage(contour, [
    { id: 'one', tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 1 }] },
    { id: 'two', tokens: [{ kind: 'move-to-anchor', anchor: { contourId: 0, commandIndex: 2, point: 'end' } }, { kind: 'source-range', fromCommand: 2, toCommand: 3 }] },
  ])).toEqual([1, 1, 2, 1])
})

test('compiles a preview by replaying source commands and explicit anchors only', () => {
  expect(compileSplitPiecePreview(contour, {
    id: 'piece',
    tokens: [
      { kind: 'move-to-anchor', anchor: { contourId: 0, commandIndex: 1, point: 'end' } },
      { kind: 'source-range', fromCommand: 2, toCommand: 3 },
      { kind: 'close-to-start', reason: 'interior-closure-seam' },
    ],
  })).toBe('M10 0 L10 10 Z Z')
})
