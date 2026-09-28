import type { Unit } from '../domain/models/unit'
import type { CourseRepository } from '../domain/repositories/course-repository'

export function getUnit(
  courseRepo: CourseRepository,
  unitId: string,
): Promise<Unit | null> {
  return courseRepo.getUnitById(unitId)
}
