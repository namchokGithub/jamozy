import { Link, useLoaderData } from 'react-router'
import {
  ArrowUpRight,
  BookOpen,
  Flower2,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react'
import type { CourseListLoaderData } from './CourseListPage.loader'
import mascot from '../../assets/jamozy-mascot.png'

export default function CourseListPage() {
  const { courses, dueReviewCount } = useLoaderData() as CourseListLoaderData

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf1] px-4 py-5 text-[#253247] sm:px-6 sm:py-8">
      <div
        className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-[#f8d9d4]/50 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#dce9c8]/50 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bc6c5d]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f2c5bb] text-[#8d4c43] shadow-sm">
              <Flower2 aria-hidden="true" size={21} strokeWidth={2.4} />
            </span>
            <span className="text-xl font-bold tracking-tight">Jamozy</span>
          </Link>

          <nav
            className="flex items-center gap-2"
            aria-label="Account navigation"
          >
            <Link
              to="/profile"
              aria-label="Profile"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd4] bg-white/80 text-[#596579] shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8b3a9] hover:text-[#8d4c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
            >
              <UserRound aria-hidden="true" size={18} />
            </Link>
            <Link
              to="/settings"
              aria-label="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd4] bg-white/80 text-[#596579] shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8b3a9] hover:text-[#8d4c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
            >
              <Settings aria-hidden="true" size={18} />
            </Link>
          </nav>
        </header>

        <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-[#f0dfd1] bg-[#fffdf9] px-6 py-8 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] sm:px-10 sm:py-11">
          <div
            className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-[#f5dfb7]/50"
            aria-hidden="true"
          />
          <div className="relative max-w-xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#a85d4e]">
              <Sparkles aria-hidden="true" size={16} />
              YOUR KOREAN CORNER
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#253247] sm:text-5xl">
              Learn Hangul, at your pace.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-[#667085] sm:text-lg">
              A calm little space to build your Korean typing confidence, one
              lesson at a time.
            </p>
          </div>

          <img
            src={mascot}
            alt=""
            className="pointer-events-none absolute -bottom-9 right-1 hidden w-48 rotate-6 drop-shadow-[0_18px_14px_rgba(103,74,51,0.18)] sm:block md:right-10 md:w-56"
          />
        </section>

        {dueReviewCount > 0 && (
          <Link
            to="/review"
            className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#f1d5af] bg-[#fff1dc] px-5 py-4 text-[#7f5632] transition hover:-translate-y-0.5 hover:bg-[#ffe9c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
          >
            <span className="flex items-center gap-3 text-sm font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70">
                <BookOpen aria-hidden="true" size={18} />
              </span>
              {dueReviewCount} words due for review · ready when you are
            </span>
            <ArrowUpRight aria-hidden="true" size={18} />
          </Link>
        )}

        <section className="mt-10" aria-labelledby="learning-path-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#a85d4e]">
                START WHERE YOU ARE
              </p>
              <h2
                id="learning-path-heading"
                className="mt-1 text-2xl font-bold tracking-tight text-[#253247]"
              >
                Your learning path
              </h2>
            </div>
            {courses.length > 0 && (
              <span className="rounded-full bg-white/70 px-3 py-1.5 text-sm font-medium text-[#667085]">
                {courses.length} {courses.length === 1 ? 'course' : 'courses'}
              </span>
            )}
          </div>

          {courses.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[#dfcfc0] bg-white/60 px-6 py-10 text-center">
              <Flower2
                className="mx-auto text-[#c98578]"
                aria-hidden="true"
                size={28}
              />
              <p className="mt-3 font-semibold text-[#39465b]">
                Your courses will bloom here.
              </p>
              <p className="mt-1 text-sm text-[#667085]">No courses yet.</p>
              <p className="mt-1 text-sm text-[#667085]">
                Check back soon for your next lesson.
              </p>
            </div>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {courses.map((course, index) => (
                <li key={course.id}>
                  <Link
                    to={`/courses/${course.id}`}
                    className="group flex h-full min-h-48 flex-col rounded-3xl border border-[#eadfd4] bg-white/85 p-6 shadow-[0_14px_35px_-28px_rgba(54,41,31,0.7)] transition duration-200 hover:-translate-y-1 hover:border-[#d6aa9f] hover:shadow-[0_20px_35px_-24px_rgba(145,93,76,0.45)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bc6c5d]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e9e1f8] text-[#7863a8]">
                        <span className="text-sm font-bold">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="text-[#a7a0a0] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#a85d4e]"
                        aria-hidden="true"
                        size={20}
                      />
                    </div>
                    <div className="mt-auto pt-8">
                      <h3 className="text-xl font-bold tracking-tight text-[#253247]">
                        {course.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#667085]">
                        {course.description}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
