import { z } from 'zod'

// The static Home course export (DEC-043): written by the build-time export
// script and validated again when Home reads it.
const exerciseSchema = z.object({
  id: z.string().min(1),
  targetText: z.string().min(1),
  romanization: z.string().nullable(),
  meaningTh: z.string(),
  meaningEn: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  hint: z.string().nullable(),
})

const lessonSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  type: z.enum(['character', 'syllable', 'word', 'phrase', 'sentence']),
  order: z.number(),
  exercises: z.array(exerciseSchema).min(1),
})

const unitSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  order: z.number(),
  lessons: z.array(lessonSchema),
})

const hasUniqueIds = (items: Array<{ id: string }>) =>
  new Set(items.map(({ id }) => id)).size === items.length

export const homeContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: z.string(),
    course: z.object({
      id: z.string().min(1),
      title: z.string(),
      description: z.string(),
    }),
    units: z.array(unitSchema),
  })
  .refine((content) => hasUniqueIds(content.units), 'Unit ids must be unique')
  .refine(
    (content) => hasUniqueIds(content.units.flatMap(({ lessons }) => lessons)),
    'Lesson ids must be unique',
  )
  .refine(
    (content) =>
      content.units.every(({ lessons }) =>
        lessons.every(({ exercises }) => hasUniqueIds(exercises))),
    'Exercise ids must be unique within a lesson',
  )

export type HomeContent = z.infer<typeof homeContentSchema>
export type HomeUnit = HomeContent['units'][number]
export type HomeLesson = HomeUnit['lessons'][number]
