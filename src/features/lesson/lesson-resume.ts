const RESUME_WINDOW_MS = 5 * 60 * 1000
const STORAGE_KEY = 'jamozy:lesson-resume'

export interface LessonResume {
  lessonId: string
  expiresAtMs: number
}

function parseLessonResume(value: string | null): LessonResume | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('lessonId' in parsed) ||
      !('expiresAtMs' in parsed) ||
      typeof parsed.lessonId !== 'string' ||
      typeof parsed.expiresAtMs !== 'number'
    ) {
      return null
    }
    return {
      lessonId: parsed.lessonId,
      expiresAtMs: parsed.expiresAtMs,
    }
  } catch {
    return null
  }
}

export function saveLessonResume(
  storage: Storage,
  lessonId: string,
  nowMs: number,
): LessonResume {
  const resume = { lessonId, expiresAtMs: nowMs + RESUME_WINDOW_MS }
  storage.setItem(STORAGE_KEY, JSON.stringify(resume))
  return resume
}

export function getLessonResume(
  storage: Storage,
  lessonId: string,
  navigationType: string,
  nowMs: number,
): LessonResume | null {
  const resume = parseLessonResume(storage.getItem(STORAGE_KEY))
  if (!resume || resume.expiresAtMs <= nowMs) {
    storage.removeItem(STORAGE_KEY)
    return null
  }
  if (navigationType !== 'reload') {
    storage.removeItem(STORAGE_KEY)
    return null
  }
  if (resume.lessonId !== lessonId) {
    storage.removeItem(STORAGE_KEY)
    return null
  }
  return resume
}

export function clearLessonResume(storage: Storage): void {
  storage.removeItem(STORAGE_KEY)
}
