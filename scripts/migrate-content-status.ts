import { getAdminServices } from './admin-sdk'

export type StatusMigrationSummary = {
  scanned: number
  updated: number
  dryRun: boolean
}

interface AdminFirestore {
  collection(name: string): {
    get(): Promise<{
      docs: Array<{
        ref: { update(value: Record<string, unknown>): Promise<unknown> }
        data(): Record<string, unknown>
      }>
    }>
  }
}

export async function migrateContentStatus(
  db: AdminFirestore,
  dryRun: boolean,
): Promise<StatusMigrationSummary> {
  let scanned = 0
  let updated = 0
  for (const collectionName of ['courses', 'units', 'lessons']) {
    const snapshot = await db.collection(collectionName).get()
    for (const document of snapshot.docs) {
      scanned += 1
      if (document.data().status) continue
      updated += 1
      if (!dryRun) await document.ref.update({ status: 'published' })
    }
  }
  return { scanned, updated, dryRun }
}

const mode = process.argv[2]
const confirmedAfterDryRun = process.argv[3] === '--after-dry-run'
if (import.meta.url === `file://${process.argv[1]}`) {
  if (
    (mode !== '--dry-run' && mode !== '--write') ||
    (mode === '--write' && !confirmedAfterDryRun)
  ) {
    console.error(
      'Run a dry-run first: pnpm content:migrate-status -- --dry-run. Then use: pnpm content:migrate-status -- --write --after-dry-run',
    )
    process.exitCode = 1
  } else {
    migrateContentStatus(getAdminServices().db, mode === '--dry-run')
      .then((summary) =>
        console.log(
          `${summary.dryRun ? 'Dry run' : 'Write'}: scanned ${summary.scanned}, ${summary.updated} statusless content documents.`,
        ),
      )
      .catch((error) => {
        console.error(error)
        process.exitCode = 1
      })
  }
}
