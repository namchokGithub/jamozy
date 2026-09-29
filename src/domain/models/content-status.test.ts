import { describe, expect, it } from 'vitest'
import {
  archiveContent,
  createDraftContentStatus,
  restoreContent,
} from './content-status'

describe('content status lifecycle', () => {
  it('starts newly created content as draft', () => {
    expect(createDraftContentStatus()).toEqual({ status: 'draft' })
  })

  it('remembers draft when archiving and restores it as draft', () => {
    const archived = archiveContent({ status: 'draft' })

    expect(archived).toEqual({
      status: 'archived',
      archivedFromStatus: 'draft',
    })
    expect(restoreContent(archived)).toEqual({ status: 'draft' })
  })

  it('remembers published when archiving and restores it as published', () => {
    const archived = archiveContent({ status: 'published' })

    expect(archived).toEqual({
      status: 'archived',
      archivedFromStatus: 'published',
    })
    expect(restoreContent(archived)).toEqual({ status: 'published' })
  })
})
