import { Link, useLoaderData } from 'react-router'
import type { CourseListLoaderData } from './CourseListPage.loader'

export default function CourseListPage() {
  const { courses, dueReviewCount } = useLoaderData() as CourseListLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-slate-900">Jamozy</h1>
        <div className="flex items-center gap-4">
          <Link to="/profile" className="text-sm text-slate-600 underline">
            Profile
          </Link>
          <Link to="/settings" className="text-sm text-slate-600 underline">
            Settings
          </Link>
        </div>
      </div>

      {dueReviewCount > 0 && (
        <Link to="/review" className="mt-2 block text-sm text-amber-700 underline">
          {dueReviewCount} words due for review
        </Link>
      )}

      {courses.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No courses yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                to={`/courses/${course.id}`}
                className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">{course.title}</div>
                <div className="text-sm text-slate-600">{course.description}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
