export type ContentStatus = 'draft' | 'published' | 'archived'

export type RestorableContentStatus = Exclude<ContentStatus, 'archived'>

export interface ContentStatusFields {
  /** Optional only while legacy documents are migrated to an explicit status. */
  status?: ContentStatus
  archivedFromStatus?: RestorableContentStatus
}

export function createDraftContentStatus(): ContentStatusFields {
  return { status: 'draft' }
}

export function isPublishedContent(content: ContentStatusFields): boolean {
  return content.status === 'published'
}

export function archiveContent(
  content: ContentStatusFields,
): ContentStatusFields {
  if (content.status === 'archived') return content

  return {
    status: 'archived',
    archivedFromStatus: content.status === 'published' ? 'published' : 'draft',
  }
}

export function restoreContent(
  content: ContentStatusFields,
): ContentStatusFields {
  if (content.status !== 'archived') return content

  return { status: content.archivedFromStatus ?? 'draft' }
}
