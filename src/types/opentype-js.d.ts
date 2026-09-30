declare module 'opentype.js' {
  interface PathCommand {
    type: string
    x?: number
    y?: number
    x1?: number
    y1?: number
    x2?: number
    y2?: number
  }

  interface Path {
    commands: PathCommand[]
  }

  interface Glyph {
    advanceWidth: number
    getBoundingBox(): {
      x1: number
      y1: number
      x2: number
      y2: number
    }
    getPath(x: number, y: number, fontSize: number): Path
  }

  interface Font {
    unitsPerEm: number
    ascender: number
    descender: number
    charToGlyph(character: string): Glyph
  }

  export function parse(buffer: ArrayBuffer): Font
}
