import { describe, expect, test } from 'vitest'
import {
  commandCoverage,
  compileSplitPiecePreview,
  moveSourceRange,
  removeSourceRange,
  withDefaultSeams,
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

test('counts coverage only for ranges on the requested contour', () => {
  const pieces = [
    {
      id: 'a',
      tokens: [{ kind: 'source-range' as const, fromCommand: 0, toCommand: 3 }],
    },
    {
      id: 'b',
      tokens: [
        {
          kind: 'source-range' as const,
          contourId: 7,
          fromCommand: 1,
          toCommand: 2,
        },
      ],
    },
  ]
  expect(commandCoverage(contour, pieces)).toEqual([1, 1, 1, 1])
  expect(commandCoverage({ ...contour, id: 7 }, pieces, 0)).toEqual([
    0, 1, 1, 0,
  ])
})

describe('moveSourceRange', () => {
  const range = (
    fromCommand: number,
    toCommand: number,
    contourId?: number,
  ) => ({
    kind: 'source-range' as const,
    fromCommand,
    toCommand,
    ...(contourId === undefined ? {} : { contourId }),
  })
  const seam = (contourId: number, commandIndex: number) => ({
    kind: 'line-to-anchor' as const,
    anchor: { contourId, commandIndex, point: 'end' as const },
    reason: 'interior-closure-seam' as const,
  })

  // 역's ㅕ piece: outline 0–4, counter 1–3, outline 19–21.
  const yeok = [
    range(0, 4),
    seam(3, 0),
    range(1, 3, 3),
    seam(1, 18),
    range(19, 21),
  ]

  test('moves a range down and rebuilds each seam to end before the next range', () => {
    expect(moveSourceRange(yeok, 2, 1, 1)).toEqual([
      range(0, 4),
      seam(1, 18),
      range(19, 21),
      seam(3, 0),
      range(1, 3, 3),
    ])
  })

  test('moves a range up to the front without a leading seam', () => {
    expect(moveSourceRange(yeok, 4, -1, 1)).toEqual([
      range(0, 4),
      seam(1, 18),
      range(19, 21),
      seam(3, 0),
      range(1, 3, 3),
    ])
    // A range starting at command 0 needs no seam before it.
    expect(moveSourceRange(yeok, 2, -1, 1)).toEqual([
      range(1, 3, 3),
      range(0, 4),
      seam(1, 18),
      range(19, 21),
    ])
  })

  test('leaves tokens unchanged at the ends or for a non-range token', () => {
    expect(moveSourceRange(yeok, 0, -1, 1)).toBe(yeok)
    expect(moveSourceRange(yeok, 4, 1, 1)).toBe(yeok)
    expect(moveSourceRange(yeok, 1, 1, 1)).toBe(yeok)
  })

  test('keeps a trailing close-to-start seam last', () => {
    const tokens = [
      range(4, 10),
      range(4, 7, 2),
      {
        kind: 'close-to-start' as const,
        reason: 'interior-closure-seam' as const,
      },
    ]
    expect(moveSourceRange(tokens, 1, -1, 0)).toEqual([
      range(4, 7, 2),
      seam(0, 3),
      range(4, 10),
      { kind: 'close-to-start', reason: 'interior-closure-seam' },
    ])
  })
})

describe('withDefaultSeams', () => {
  const range = (
    fromCommand: number,
    toCommand: number,
    contourId?: number,
  ) => ({
    kind: 'source-range' as const,
    fromCommand,
    toCommand,
    ...(contourId === undefined ? {} : { contourId }),
  })
  const seam = (contourId: number, commandIndex: number) => ({
    kind: 'line-to-anchor' as const,
    anchor: { contourId, commandIndex, point: 'end' as const },
    reason: 'interior-closure-seam' as const,
  })

  test('adds the default seam before a newly appended range', () => {
    expect(withDefaultSeams([range(0, 4), range(1, 3, 3)], 1)).toEqual([
      range(0, 4),
      seam(3, 0),
      range(1, 3, 3),
    ])
  })

  test('replaces a stale seam after a range changed', () => {
    expect(
      withDefaultSeams([range(0, 4), seam(1, 9), range(11, 21)], 1),
    ).toEqual([range(0, 4), seam(1, 10), range(11, 21)])
  })

  test('leaves pieces with move anchors unchanged', () => {
    const tokens = [
      {
        kind: 'move-to-anchor' as const,
        anchor: { contourId: 0, commandIndex: 2, point: 'end' as const },
      },
      range(3, 5),
    ]
    expect(withDefaultSeams(tokens, 0)).toBe(tokens)
  })
})
