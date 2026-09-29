import { describe, expect, it } from 'vitest'
import { archiveCourse, publishLesson, restoreCourse } from './admin-content'
import { FakeAdminContentRepository } from '../test/fakes'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
import type { Lesson } from '../domain/models/lesson'

const now = new Date('2026-09-29')
const course: Course = { id: 'course', title: 'Course', description: 'Description', order: 0, status: 'published', createdAt: now, updatedAt: now }
const unit: Unit = { id: 'unit', courseId: 'course', title: 'Unit', description: 'Description', order: 0, status: 'published', createdAt: now, updatedAt: now }
function lesson(exercises: Lesson['exercises'], status: Lesson['status'] = 'draft'): Lesson { return { id: 'lesson', unitId: 'unit', title: 'Lesson', type: 'word', order: 0, status, exercises, createdAt: now, updatedAt: now } }

describe('admin content lifecycle', () => {
  it('blocks publishing a Lesson without an Exercise', async () => {
    const repo = new FakeAdminContentRepository([course], [unit], [lesson([])])
    await expect(publishLesson(repo, lesson([]))).resolves.toEqual({ ok: false, error: 'Add at least one Exercise before publishing.' })
    expect((await repo.getLessonById('lesson'))?.status).toBe('draft')
  })

  it('blocks publishing a Lesson below a non-published parent', async () => {
    const repo = new FakeAdminContentRepository([{ ...course, status: 'draft' }], [unit], [lesson([{ id: 'exercise', targetText: '가', romanization: null, meaningTh: '', meaningEn: '', difficulty: 'easy', hint: null }])])
    await expect(publishLesson(repo, (await repo.getLessonById('lesson'))!)).resolves.toEqual({ ok: false, error: 'Publish the parent Course first.' })
  })

  it('restores an archived draft Course as draft', async () => {
    const draft = { ...course, status: 'draft' as const }
    const repo = new FakeAdminContentRepository([draft])
    await archiveCourse(repo, draft)
    await restoreCourse(repo, (await repo.getCourseById('course'))!)
    expect((await repo.getCourseById('course'))?.status).toBe('draft')
  })
})
