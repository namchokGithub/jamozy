import { z } from 'zod'
import {
  pressKey as typingSessionPressKey,
  startTypingSession,
  type MistakeEvent,
  type TypingSessionState,
} from './typing-session'
import type { LessonExercise } from '../models/lesson'

export interface ExerciseResult {
  exerciseId: string
  targetText: string
  correctKeyCount: number
  mistakes: MistakeEvent[]
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
})

export interface LessonSessionState {
  exercises: Array<Pick<LessonExercise, 'id' | 'targetText'>>
  currentIndex: number
  currentSession: TypingSessionState
  completedResults: ExerciseResult[]
  lastCompletedExercise: ExerciseResult | null
  startedAt: Date
  status: 'typing' | 'completed'
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
  }
}

export function pressKey(state: LessonSessionState, code: string, shiftKey: boolean): LessonSessionState {
  if (state.status === 'completed') {
    return state
  }

  const nextSession = typingSessionPressKey(state.currentSession, code, shiftKey)
  if (nextSession.status !== 'completed') {
    return { ...state, currentSession: nextSession, lastCompletedExercise: null }
  }

  const exercise = state.exercises[state.currentIndex]
  const result: ExerciseResult = {
    exerciseId: exercise.id,
    targetText: exercise.targetText,
    correctKeyCount: nextSession.keyIndex,
    mistakes: nextSession.mistakes,
  }
  const completedResults = [...state.completedResults, result]
  const nextIndex = state.currentIndex + 1

  if (nextIndex >= state.exercises.length) {
    return { ...state, currentSession: nextSession, completedResults, lastCompletedExercise: result, status: 'completed' }
  }

  return {
    ...state,
    currentIndex: nextIndex,
    currentSession: startTypingSession(state.exercises[nextIndex].targetText),
    completedResults,
    lastCompletedExercise: result,
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
})
