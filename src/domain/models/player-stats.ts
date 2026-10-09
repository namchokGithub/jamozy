import type { LessonType } from './lesson'
import type { LearningSession } from './learning-session'

// Player stats (DEC-049): per-session inputs and the pure fold that keeps
// lifetime state, daily docs, and monthly docs. Every adapter calls
// applySessionStats inside its receipt-deduped submit transaction.

export interface ExerciseStat {
  targetText: string
  mistakeCount: number
  typingSeconds: number
  elapsedSeconds: number
  lessonType?: LessonType
}

export interface PeriodStats {
  expEarned: number
  lessonsCompleted: number
  lessonsReplayed: number
  reviewsCompleted: number
  perfectLessons: number
  correctKeystrokes: number
  incorrectKeystrokes: number
  charactersTyped: number
  wordsPracticed: number
  sentencesPracticed: number
  typingSeconds: number
  learningSeconds: number
}

export interface DatedRecord {
  value: number
  period: string
}

export interface PlayerStats {
  activeDays: number
  streak: { current: number; longest: number; lastActiveDate: string | null }
  perfectStreak: { current: number; longest: number }
  records: {
    mostExpDay: DatedRecord | null
    mostExpMonth: DatedRecord | null
    mostLessonsDay: DatedRecord | null
  }
}

export type SessionStats = Required<
  Pick<
    LearningSession,
    | 'localDate'
    | 'timeZone'
    | 'typingSeconds'
    | 'charactersTyped'
    | 'wordsPracticed'
    | 'sentencesPracticed'
    | 'exerciseMistakes'
  >
>

export const FALLBACK_TIME_ZONE = 'Asia/Bangkok'

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE
  } catch {
    return FALLBACK_TIME_ZONE
  }
}

/** Calendar date ('YYYY-MM-DD') of `date` in `timeZone`. */
export function localDateIn(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((value) => value.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const HANGUL_SYLLABLE = /[가-힣]/gu
const syllableCount = (text: string) => text.match(HANGUL_SYLLABLE)?.length ?? 0

export function sessionStatsFrom(
  exercises: ExerciseStat[],
  lessonType: LessonType | undefined,
  timeZone: string,
  completedAt: Date,
): SessionStats {
  const typeOf = (exercise: ExerciseStat) => exercise.lessonType ?? lessonType
  return {
    localDate: localDateIn(completedAt, timeZone),
    timeZone,
    typingSeconds: exercises.reduce((sum, exercise) => sum + exercise.typingSeconds, 0),
    charactersTyped: exercises.reduce((sum, exercise) => sum + syllableCount(exercise.targetText), 0),
    wordsPracticed: exercises.filter((exercise) => typeOf(exercise) === 'word').length,
    sentencesPracticed: exercises.filter((exercise) => {
      const type = typeOf(exercise)
      return type === 'phrase' || type === 'sentence'
    }).length,
    exerciseMistakes: exercises.map((exercise) => exercise.mistakeCount),
  }
}

export const emptyPeriodStats = (): PeriodStats => ({
  expEarned: 0,
  lessonsCompleted: 0,
  lessonsReplayed: 0,
  reviewsCompleted: 0,
  perfectLessons: 0,
  correctKeystrokes: 0,
  incorrectKeystrokes: 0,
  charactersTyped: 0,
  wordsPracticed: 0,
  sentencesPracticed: 0,
  typingSeconds: 0,
  learningSeconds: 0,
})

export const emptyPlayerStats = (): PlayerStats => ({
  activeDays: 0,
  streak: { current: 0, longest: 0, lastActiveDate: null },
  perfectStreak: { current: 0, longest: 0 },
  records: { mostExpDay: null, mostExpMonth: null, mostLessonsDay: null },
})

export function periodStatsFrom(session: LearningSession): PeriodStats {
  const isReview = session.context.mode === 'review'
  const isLesson = !isReview
  return {
    expEarned: session.expGained,
    lessonsCompleted: isLesson ? 1 : 0,
    lessonsReplayed: isLesson && session.isReplay ? 1 : 0,
    reviewsCompleted: isReview ? 1 : 0,
    perfectLessons: isLesson && session.rejectedKeystrokes === 0 ? 1 : 0,
    correctKeystrokes: session.acceptedKeystrokes,
    incorrectKeystrokes: session.rejectedKeystrokes,
    charactersTyped: session.charactersTyped ?? 0,
    wordsPracticed: session.wordsPracticed ?? 0,
    sentencesPracticed: session.sentencesPracticed ?? 0,
    typingSeconds: session.typingSeconds ?? 0,
    learningSeconds: session.learningSeconds ?? session.durationSeconds,
  }
}

function addPeriod(current: PeriodStats | null, next: PeriodStats): PeriodStats {
  const base = { ...emptyPeriodStats(), ...current }
  return Object.fromEntries(
    Object.entries(next).map(([key, value]) => [
      key,
      (base[key as keyof PeriodStats] ?? 0) + value,
    ]),
  ) as unknown as PeriodStats
}

const dayAfter = (date: string) => {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

function nextStreak(streak: PlayerStats['streak'], date: string): PlayerStats['streak'] {
  const last = streak.lastActiveDate
  if (last !== null && date <= last) return streak
  const current = last !== null && date === dayAfter(last) ? streak.current + 1 : 1
  return { current, longest: Math.max(streak.longest, current), lastActiveDate: date }
}

function nextPerfectStreak(
  streak: PlayerStats['perfectStreak'],
  mistakes: number[],
): PlayerStats['perfectStreak'] {
  let { current, longest } = streak
  for (const count of mistakes) {
    current = count === 0 ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return { current, longest }
}

const higher = (record: DatedRecord | null, value: number, period: string): DatedRecord | null =>
  value > 0 && value > (record?.value ?? 0) ? { value, period } : record

export function applySessionStats(
  current: {
    player: PlayerStats | undefined
    daily: PeriodStats | null
    monthly: PeriodStats | null
    profileTimeZone: string | undefined
  },
  session: LearningSession,
): {
  player: PlayerStats
  daily: PeriodStats
  monthly: PeriodStats
  date: string
  month: string
} {
  const date = session.localDate ?? localDateIn(
    session.completedAt,
    current.profileTimeZone ?? session.timeZone ?? FALLBACK_TIME_ZONE,
  )
  const month = date.slice(0, 7)
  const period = periodStatsFrom(session)
  const daily = addPeriod(current.daily, period)
  const monthly = addPeriod(current.monthly, period)
  const player = { ...emptyPlayerStats(), ...current.player }
  return {
    date,
    month,
    daily,
    monthly,
    player: {
      activeDays: player.activeDays + (current.daily ? 0 : 1),
      streak: nextStreak(player.streak, date),
      perfectStreak: nextPerfectStreak(player.perfectStreak, session.exerciseMistakes ?? []),
      records: {
        mostExpDay: higher(player.records.mostExpDay, daily.expEarned, date),
        mostExpMonth: higher(player.records.mostExpMonth, monthly.expEarned, month),
        mostLessonsDay: higher(player.records.mostLessonsDay, daily.lessonsCompleted, date),
      },
    },
  }
}
