import { z } from 'zod'
import {
  pressKey as typingSessionPressKey,
  startTypingSession,
  type MistakeEvent,
  type TypingSessionState,
} from './typing-session'
import type { LessonExercise } from '../models/lesson'
import type { ExerciseStat } from '../models/player-stats'

export const TYPING_GAP_LIMIT_MS = 10_000

interface ExerciseTiming {
  firstKeyAtMs: number | null
  lastKeyAtMs: number | null
  typingMs: number
}

const emptyTiming = (): ExerciseTiming => ({
  firstKeyAtMs: null,
  lastKeyAtMs: null,
  typingMs: 0,
})

function nextTiming(timing: ExerciseTiming, nowMs: number | undefined): ExerciseTiming {
  if (nowMs === undefined) return timing
  const gap = timing.lastKeyAtMs === null ? 0 : nowMs - timing.lastKeyAtMs
  return {
    firstKeyAtMs: timing.firstKeyAtMs ?? nowMs,
    lastKeyAtMs: nowMs,
    typingMs: timing.typingMs + (gap > 0 && gap <= TYPING_GAP_LIMIT_MS ? gap : 0),
  }
}

export interface ExerciseResult {
  exerciseId: string
  targetText: string
  correctKeyCount: number
  mistakes: MistakeEvent[]
  typingSeconds?: number
  elapsedSeconds?: number
}

export const exerciseResultSchema = z.object({
  exerciseId: z.string().min(1),
  targetText: z.string(),
  correctKeyCount: z.number().int().nonnegative(),
  mistakes: z.array(
    z.object({
      syllableIndex: z.number().int().nonnegative(),
      expectedCode: z.string(),
      expectedShift: z.boolean(),
      expectedJamo: z.string(),
      pressedCode: z.string(),
      pressedShift: z.boolean(),
    }),
  ),
  typingSeconds: z.number().min(0).optional(),
  elapsedSeconds: z.number().min(0).optional(),
})

export interface LessonSessionState {
  exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>
  currentIndex: number
  currentSession: TypingSessionState
  completedResults: ExerciseResult[]
  lastCompletedExercise: ExerciseResult | null
  startedAt: Date
  status: 'typing' | 'completed'
  timing?: ExerciseTiming
}

export function startLessonSession(
  exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>,
  now: Date = new Date(),
): LessonSessionState {
  return {
    exercises,
    currentIndex: 0,
    currentSession: startTypingSession(exercises[0]?.targetText ?? ''),
    completedResults: [],
    lastCompletedExercise: null,
    startedAt: now,
    status: exercises.length === 0 ? 'completed' : 'typing',
    timing: emptyTiming(),
  }
}

export function pressKey(
  state: LessonSessionState,
  code: string,
  shiftKey: boolean,
  nowMs?: number,
): LessonSessionState {
  if (state.status === 'completed') {
    return state
  }

  const nextSession = typingSessionPressKey(state.currentSession, code, shiftKey)
  if (nextSession === state.currentSession)
    return { ...state, lastCompletedExercise: null }

  const timing = nextTiming(state.timing ?? emptyTiming(), nowMs)
  if (nextSession.status !== 'completed') {
    return { ...state, currentSession: nextSession, lastCompletedExercise: null, timing }
  }

  const exercise = state.exercises[state.currentIndex]
  const result: ExerciseResult = {
    exerciseId: exercise.id,
    targetText: exercise.targetText,
    correctKeyCount: nextSession.keyIndex,
    mistakes: nextSession.mistakes,
    typingSeconds: timing.typingMs / 1000,
    elapsedSeconds:
      timing.firstKeyAtMs === null || timing.lastKeyAtMs === null
        ? 0
        : (timing.lastKeyAtMs - timing.firstKeyAtMs) / 1000,
  }
  const completedResults = [...state.completedResults, result]
  const nextIndex = state.currentIndex + 1

  if (nextIndex >= state.exercises.length) {
    return {
      ...state,
      currentSession: nextSession,
      completedResults,
      lastCompletedExercise: result,
      status: 'completed',
      timing: emptyTiming(),
    }
  }

  return {
    ...state,
    currentIndex: nextIndex,
    currentSession: startTypingSession(state.exercises[nextIndex].targetText),
    completedResults,
    lastCompletedExercise: result,
    timing: emptyTiming(),
  }
}

// Extends a running session without resetting the current exercise, its
// timer, or its counters. A session that already ran out of exercises moves
// straight to the first appended one.
export function appendExercises(
  state: LessonSessionState,
  exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>,
): LessonSessionState {
  if (exercises.length === 0) return state
  const appended = [...state.exercises, ...exercises]
  if (state.status !== 'completed') return { ...state, exercises: appended }
  const nextIndex = state.exercises.length
  return {
    ...state,
    exercises: appended,
    currentIndex: nextIndex,
    currentSession: startTypingSession(appended[nextIndex].targetText),
    status: 'typing',
  }
}

// Drops exercises before the current one and their results, so a continuous
// session does not grow without bound. Callers must consume completedResults
// first; the current exercise is kept even when the session is completed.
export function compactLessonSession(state: LessonSessionState): LessonSessionState {
  return {
    ...state,
    exercises: state.exercises.slice(state.currentIndex),
    currentIndex: 0,
    completedResults: [],
    lastCompletedExercise: null,
  }
}

export interface MistakeReport {
  sourceExerciseId: string
  targetText: string
}

export interface LessonResult {
  accuracy: number
  speedWpm: number
  durationSeconds: number
  startedAtMs: number
  exercisesAttempted: number
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  mistakes: MistakeReport[]
  exercises?: ExerciseStat[]
}

export function getLessonResult(state: LessonSessionState, now: Date = new Date()): LessonResult {
  const totalCorrectKeystrokes = state.completedResults.reduce((sum, r) => sum + r.correctKeyCount, 0)
  const totalMistakes = state.completedResults.reduce((sum, r) => sum + r.mistakes.length, 0)
  const accuracy =
    totalCorrectKeystrokes + totalMistakes === 0
      ? 0
      : (totalCorrectKeystrokes / (totalCorrectKeystrokes + totalMistakes)) * 100

  const durationSeconds = (now.getTime() - state.startedAt.getTime()) / 1000
  const speedWpm = durationSeconds === 0 ? 0 : (totalCorrectKeystrokes / 5) / (durationSeconds / 60)

  const mistakes = state.completedResults
    .filter((r) => r.mistakes.length > 0)
    .map((r) => ({ sourceExerciseId: r.exerciseId, targetText: r.targetText }))

  return {
    accuracy,
    speedWpm,
    durationSeconds,
    startedAtMs: state.startedAt.getTime(),
    exercisesAttempted: state.completedResults.length,
    acceptedKeystrokes: totalCorrectKeystrokes,
    rejectedKeystrokes: totalMistakes,
    mistakes,
    exercises: state.completedResults.map((result) => ({
      targetText: result.targetText,
      mistakeCount: result.mistakes.length,
      typingSeconds: result.typingSeconds ?? 0,
      elapsedSeconds: result.elapsedSeconds ?? 0,
    })),
  }
}

export function getLessonProgress(state: LessonSessionState): { current: number; total: number } {
  return { current: state.completedResults.length, total: state.exercises.length }
}

export const lessonResultSchema = z.object({
  accuracy: z.number().min(0).max(100),
  speedWpm: z.number().min(0),
  durationSeconds: z.number().min(0),
  startedAtMs: z.number().int().nonnegative(),
  exercisesAttempted: z.number().int().min(0),
  acceptedKeystrokes: z.number().int().min(0),
  rejectedKeystrokes: z.number().int().min(0),
  mistakes: z.array(
    z.object({
      sourceExerciseId: z.string(),
      targetText: z.string(),
    }),
  ),
  exercises: z
    .array(
      z.object({
        targetText: z.string(),
        mistakeCount: z.number().int().min(0),
        typingSeconds: z.number().min(0),
        elapsedSeconds: z.number().min(0),
      }),
    )
    .max(100)
    .optional(),
})
