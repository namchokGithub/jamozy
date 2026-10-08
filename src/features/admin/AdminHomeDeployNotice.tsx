import { courseType, type Course } from '../../domain/models/course'
import { useAdminTranslation } from './i18n/admin-i18n'

/** Home content ships as a build-time export (DEC-043), not live from Firestore. */
export function AdminHomeDeployNotice({ course }: { course: Course | null }) {
  const { t } = useAdminTranslation()
  if (!course || courseType(course) !== 'home') return null
  return (
    <div
      role="note"
      className="mt-4 rounded-xl bg-[#eef3fb] px-4 py-3 text-sm font-semibold text-[#3d5a80]"
    >
      {t('notice.homeDeploy')}
    </div>
  )
}
