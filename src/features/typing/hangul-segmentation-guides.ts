export type GuideShape = 'rect' | 'ellipse'
export type GuideMode = 'add' | 'subtract'

export interface GuideOperation {
  mode: GuideMode
  shape: GuideShape
  normRect: { x: number; y: number; w: number; h: number }
}

export interface SyllableGuide {
  steps: Array<{ order: number; key: string; ops: GuideOperation[] }>
}

interface GuideRect {
  x: number
  y: number
  width: number
  height: number
}

const rect = (x: number, y: number, w: number, h: number): GuideOperation => ({
  mode: 'add',
  shape: 'rect',
  normRect: { x, y, w, h },
})

function guide(keys: string[], regions: GuideRect[]): SyllableGuide {
  return {
    steps: keys.map((key, order) => ({
      order,
      key,
      ops: [
        rect(
          regions[order].x,
          regions[order].y,
          regions[order].width,
          regions[order].height,
        ),
      ],
    })),
  }
}

const VERTICAL = [
  { x: 0, y: 0, width: 0.56, height: 1 },
  { x: 0.44, y: 0, width: 0.56, height: 1 },
]
const VERTICAL_FINAL = [
  { x: 0, y: 0, width: 0.56, height: 0.7 },
  { x: 0.44, y: 0, width: 0.56, height: 0.7 },
  { x: 0.05, y: 0.62, width: 0.9, height: 0.38 },
]
const HORIZONTAL = [
  { x: 0, y: 0, width: 1, height: 0.54 },
  { x: 0, y: 0.42, width: 1, height: 0.58 },
]
const HORIZONTAL_FINAL = [
  { x: 0, y: 0, width: 1, height: 0.4 },
  { x: 0, y: 0.32, width: 1, height: 0.42 },
  { x: 0.05, y: 0.65, width: 0.9, height: 0.35 },
]

// Paste an approved { "syllable": { "steps": [...] } } export from the tuner here.
export const SYLLABLE_GUIDES: Record<string, SyllableGuide> = {
  안: guide(['ㅇ', 'ㅏ', 'ㄴ'], VERTICAL_FINAL),
  녕: guide(
    ['ㄴ', 'ㅕ', 'ㅇ'],
    [
      { x: 0, y: 0, width: 0.58, height: 0.62 },
      { x: 0.58, y: 0, width: 0.42, height: 0.62 },
      { x: 0, y: 0.62, width: 1, height: 0.38 },
    ],
  ),
  하: guide(
    ['ㅎ', 'ㅏ'],
    [
      { x: 0, y: 0, width: 0.62, height: 1 },
      { x: 0.62, y: 0, width: 0.38, height: 1 },
    ],
  ),
  세: guide(['ㅅ', 'ㅔ'], VERTICAL),
  요: guide(['ㅇ', 'ㅛ'], HORIZONTAL),
  감: guide(['ㄱ', 'ㅏ', 'ㅁ'], VERTICAL_FINAL),
  사: guide(['ㅅ', 'ㅏ'], VERTICAL),
  합: guide(['ㅎ', 'ㅏ', 'ㅂ'], VERTICAL_FINAL),
  니: guide(['ㄴ', 'ㅣ'], VERTICAL),
  다: guide(['ㄷ', 'ㅏ'], VERTICAL),
  죄: guide(
    ['ㅈ', 'ㅗ', 'ㅣ'],
    [
      { x: 0, y: 0, width: 1, height: 0.38 },
      { x: 0, y: 0.38, width: 0.6, height: 0.62 },
      { x: 0.6, y: 0.38, width: 0.4, height: 0.62 },
    ],
  ),
  송: guide(['ㅅ', 'ㅗ', 'ㅇ'], HORIZONTAL_FINAL),
  랑: guide(['ㄹ', 'ㅏ', 'ㅇ'], VERTICAL_FINAL),
  친: guide(['ㅊ', 'ㅣ', 'ㄴ'], VERTICAL_FINAL),
  구: guide(['ㄱ', 'ㅜ'], HORIZONTAL),
  학: guide(['ㅎ', 'ㅏ', 'ㄱ'], VERTICAL_FINAL),
  교: guide(['ㄱ', 'ㅛ'], HORIZONTAL),
}
