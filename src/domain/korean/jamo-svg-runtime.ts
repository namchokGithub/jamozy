/** One syllable: its advance width and one path per typed key, in typing order. */
export type RuntimeJamoSvgGlyph = {
  width: number
  paths: Array<{ jamo: string; d: string }>
}

export type RuntimeJamoSvgDataset = Record<string, RuntimeJamoSvgGlyph>

/** A choseong shard file under public/jamo-svg/pretendard-600/ (DEC-039). */
export type RuntimeJamoSvgShard = {
  datasetSchemaVersion: 1
  fontSha256: string
  /** Height of every glyph's viewBox; all glyphs share one em box. */
  unitsPerEm: number
  glyphs: RuntimeJamoSvgDataset
}
