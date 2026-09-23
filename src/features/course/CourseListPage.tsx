import { Link, useLoaderData } from 'react-router'
import type { CourseListLoaderData } from './CourseListPage.loader'

export default function CourseListPage() {
  const { courses } = useLoaderData() as CourseListLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">Jamozy</h1>
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
