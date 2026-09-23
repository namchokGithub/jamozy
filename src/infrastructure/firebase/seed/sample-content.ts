import type { LessonType, LessonExercise } from '../../../domain/models/lesson'

export interface SeedCourse {
  id: string
  title: string
  description: string
  order: number
}

export interface SeedUnit {
  id: string
  courseId: string
  title: string
  description: string
  order: number
}

export interface SeedLesson {
  id: string
  unitId: string
  title: string
  type: LessonType
  order: number
  exercises: LessonExercise[]
}

export const seedCourses: SeedCourse[] = [
  {
    id: 'hangul-basics',
    title: 'Hangul Basics',
    description: 'Beginner Korean vocabulary and typing practice.',
    order: 1,
  },
]

export const seedUnits: SeedUnit[] = [
  {
    id: 'basic-greetings',
    courseId: 'hangul-basics',
    title: 'คำทักทายพื้นฐาน',
    description: 'Basic greetings',
    order: 1,
  },
  {
    id: 'common-words',
    courseId: 'hangul-basics',
    title: 'คำศัพท์ทั่วไป',
    description: 'Common everyday words',
    order: 2,
  },
]

export const seedLessons: SeedLesson[] = [
  {
    id: 'greetings-1',
    unitId: 'basic-greetings',
    title: 'ทักทาย 1',
    type: 'word',
    order: 1,
    exercises: [
      {
        id: 'greetings-1-1',
        targetText: '안녕하세요',
        romanization: 'annyeonghaseyo',
        meaningTh: 'สวัสดี',
        meaningEn: 'Hello',
        difficulty: 'easy',
        hint: null,
      },
      {
        id: 'greetings-1-2',
        targetText: '감사합니다',
        romanization: 'gamsahamnida',
        meaningTh: 'ขอบคุณ',
        meaningEn: 'Thank you',
        difficulty: 'easy',
        hint: null,
      },
      {
        id: 'greetings-1-3',
        targetText: '죄송합니다',
        romanization: 'joesonghamnida',
        meaningTh: 'ขอโทษ',
        meaningEn: 'Sorry',
        difficulty: 'easy',
        hint: null,
      },
    ],
  },
  {
    id: 'common-words-1',
    unitId: 'common-words',
    title: 'คำศัพท์ 1',
    type: 'word',
    order: 1,
    exercises: [
      {
        id: 'common-words-1-1',
        targetText: '사랑',
        romanization: 'sarang',
        meaningTh: 'รัก',
        meaningEn: 'Love',
        difficulty: 'medium',
        hint: null,
      },
      {
        id: 'common-words-1-2',
        targetText: '친구',
        romanization: 'chingu',
        meaningTh: 'เพื่อน',
        meaningEn: 'Friend',
        difficulty: 'medium',
        hint: null,
      },
      {
        id: 'common-words-1-3',
        targetText: '학교',
        romanization: 'hakgyo',
        meaningTh: 'โรงเรียน',
        meaningEn: 'School',
        difficulty: 'medium',
        hint: null,
      },
    ],
  },
]
