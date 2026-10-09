import type { JamoStats } from '../models/jamo-stat'

export interface JamoStatsRepository {
  /** The learner's key-level jamo stats (DEC-050); {} before any practice. */
  getJamoStats(userId: string): Promise<JamoStats>
}
