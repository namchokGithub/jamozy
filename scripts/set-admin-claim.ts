import { getAdminServices } from './admin-sdk'

interface AdminAuth {
  getUser(uid: string): Promise<{ customClaims?: Record<string, unknown> }>
  setCustomUserClaims(
    uid: string,
    claims: Record<string, unknown>,
  ): Promise<unknown>
}

export async function setAdminClaim(
  uid: string,
  auth: AdminAuth = getAdminServices().auth,
): Promise<void> {
  if (!uid.trim())
    throw new Error('Provide a Firebase Auth UID: pnpm admin:grant -- <uid>')
  const user = await auth.getUser(uid)
  await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true })
}

export function parseAdminClaimArgs(args: string[]): string | undefined {
  return args.find((arg) => arg !== '--')
}

const uid = parseAdminClaimArgs(process.argv.slice(2))
if (import.meta.url === `file://${process.argv[1]}`) {
  setAdminClaim(uid ?? '')
    .then(() =>
      console.log(
        `Granted admin claim to ${uid}. Sign out and back in to refresh the token.`,
      ),
    )
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}
