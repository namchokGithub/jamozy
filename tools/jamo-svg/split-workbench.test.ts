import { expect, test } from 'vitest'
import {
  commandCoverage,
  compileSplitPiecePreview,
  removeSourceRange,
  replacePrimarySourceRange,
} from './split-workbench'

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
  expect(
    commandCoverage(contour, [
      {
        id: 'one',
        tokens: [{ kind: 'source-range', fromCommand: 0, toCommand: 1 }],
      },
      {
        id: 'two',
        tokens: [
          {
            kind: 'move-to-anchor',
            anchor: { contourId: 0, commandIndex: 2, point: 'end' },
          },
          { kind: 'source-range', fromCommand: 1, toCommand: 3 },
        ],
      },
    ]),
  ).toEqual([1, 2, 1, 1])
})

test('compiles a preview by replaying source commands and explicit anchors only', () => {
  expect(
    compileSplitPiecePreview(contour, {
      id: 'piece',
      tokens: [
        {
          kind: 'move-to-anchor',
          anchor: { contourId: 0, commandIndex: 1, point: 'end' },
        },
        { kind: 'source-range', fromCommand: 2, toCommand: 3 },
        { kind: 'close-to-start', reason: 'interior-closure-seam' },
      ],
    }),
  ).toBe('M10 0 L10 10 Z Z')
})

test('starts a later source range at its original cursor without consuming another command', () => {
  expect(
    compileSplitPiecePreview(contour, {
      id: 'piece',
      tokens: [{ kind: 'source-range', fromCommand: 2, toCommand: 3 }],
    }),
  ).toBe('M10 0 L10 10 Z')
})

test('keeps a line seam between source ranges instead of starting a new subpath', () => {
  expect(
    compileSplitPiecePreview(contour, {
      id: 'piece',
      tokens: [
        { kind: 'source-range', fromCommand: 0, toCommand: 1 },
        {
          kind: 'line-to-anchor',
          anchor: { contourId: 0, commandIndex: 1, point: 'end' },
          reason: 'interior-closure-seam',
        },
        { kind: 'source-range', fromCommand: 2, toCommand: 3 },
      ],
    }),
  ).toBe('M0 0 L10 0 L10 0 L10 10 Z')
})

test('uses a leading line seam as the start of a split path', () => {
  expect(
    compileSplitPiecePreview(contour, {
      id: 'piece',
      tokens: [
        {
          kind: 'line-to-anchor',
          anchor: { contourId: 0, commandIndex: 1, point: 'end' },
          reason: 'interior-closure-seam',
        },
        { kind: 'source-range', fromCommand: 2, toCommand: 3 },
      ],
    }),
  ).toBe('M10 0 L10 10 Z')
})

test('normalizes painted bounds while preserving the piece’s other tokens', () => {
  expect(
    replacePrimarySourceRange(
      [
        { kind: 'source-range', fromCommand: 0, toCommand: 4 },
        {
          kind: 'line-to-anchor',
          anchor: { contourId: 0, commandIndex: 4, point: 'end' },
          reason: 'interior-closure-seam',
        },
        { kind: 'source-range', fromCommand: 8, toCommand: 9 },
      ],
      46,
      20,
    ),
  ).toEqual([
    { kind: 'source-range', fromCommand: 20, toCommand: 46 },
    {
      kind: 'line-to-anchor',
      anchor: { contourId: 0, commandIndex: 4, point: 'end' },
      reason: 'interior-closure-seam',
    },
    { kind: 'source-range', fromCommand: 8, toCommand: 9 },
  ])
})

test('removes only the selected source range from a piece', () => {
  expect(
    removeSourceRange(
      [
        { kind: 'source-range', fromCommand: 1, toCommand: 3 },
        {
          kind: 'line-to-anchor',
          anchor: { contourId: 0, commandIndex: 3, point: 'end' },
          reason: 'interior-closure-seam',
        },
        { kind: 'source-range', fromCommand: 33, toCommand: 36 },
      ],
      2,
    ),
  ).toEqual([
    { kind: 'source-range', fromCommand: 1, toCommand: 3 },
    {
      kind: 'line-to-anchor',
      anchor: { contourId: 0, commandIndex: 3, point: 'end' },
      reason: 'interior-closure-seam',
    },
  ])
})
