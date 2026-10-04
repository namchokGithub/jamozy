import { useEffect, useRef, useState } from 'react'
import { Link, useFetcher, useLoaderData } from 'react-router'
import {
  ArrowUpRight,
  BookOpen,
  Flower2,
  Settings,
  Sparkles,
  UserRound,
  Pencil,
  ChevronDown,
} from 'lucide-react'
import type { CourseListLoaderData } from './CourseListPage.loader'
import mascot from '../../assets/jamozy-mascot.png'
import { AuthModal } from '../auth/AuthModal'
import { Button } from '../../components/ui/Button'
import { useSnackbar } from '../../components/ui/SnackbarProvider'
import OnePageLearningPlayer from '../home/OnePageLearningPlayer'

type CourseListActionData = {
  displayName?: string
  authenticated?: boolean
  error?: string
}

export default function CourseListPage() {
  const { courses, dueReviewCount, displayName, isAuthenticated, onePageLearningPath } =
    useLoaderData() as CourseListLoaderData
  const fetcher = useFetcher<CourseListActionData>()
  const { showError, showSuccess } = useSnackbar()
  const name = fetcher.data?.displayName ?? displayName
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [showAuth, setShowAuth] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const signOutPending = useRef(false)

  useEffect(() => {
    if (signOutPending.current && fetcher.state === 'idle' && fetcher.data) {
      signOutPending.current = false
      if (fetcher.data.error) showError(fetcher.data.error)
      else showSuccess('Signed out successfully')
    }
  }, [fetcher.data, fetcher.state, showError, showSuccess])

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf1] px-4 py-5 text-[#253247] sm:px-6 sm:py-8">
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
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
            <img
              src="/templates/jamozy-hanguk-180x180.png"
              alt=""
              className="h-15 w-15 object-contain"
            />
            <span className="text-xl font-bold tracking-tight">Jamozy</span>
          </Link>

          <nav
            className="flex items-center gap-2"
            aria-label="Account navigation"
          >
            {!isAuthenticated &&
              (editingName ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    fetcher.submit(
                      { displayName: draftName },
                      { method: 'post', encType: 'application/json' },
                    )
                    setEditingName(false)
                  }}
                >
                  <input
                    aria-label="Display name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="w-28 rounded-full border px-3 py-2 text-sm"
                    autoFocus
                  />
                </form>
              ) : (
                <button
                  type="button"
                  aria-label="Edit display name"
                  onClick={() => {
                    setDraftName(name)
                    setEditingName(true)
                  }}
                  className="flex items-center gap-1 rounded-full border border-[#eadfd4] bg-white/80 px-3 py-2 text-sm shadow-sm"
                >
                  {name}
                  <Pencil aria-hidden="true" size={14} />
                </button>
              ))}
            {!isAuthenticated && !editingName && (
              <Button
                type="button"
                onClick={() => setShowAuth(true)}
                variant="secondary"
              >
                Sign in
              </Button>
            )}
            {isAuthenticated && (
              <div
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setUserMenuOpen(false)
                  }
                }}
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-[#eadfd4] bg-white/80 px-3 py-2 text-sm font-medium text-[#39465b] shadow-sm transition hover:border-[#d8b3a9] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f2edf9] text-[#7863a8]">
                    <UserRound aria-hidden="true" size={13} />
                  </span>
                  <span className="max-w-32 truncate">{name}</span>
                  <ChevronDown
                    aria-hidden="true"
                    size={15}
                    className={`transition ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-2 w-36 rounded-2xl border border-[#eadfd4] bg-[#fffdf9] p-1.5 shadow-[0_14px_28px_-16px_rgba(54,41,31,0.45)]"
                  >
                    <Link
                      to="/profile"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex rounded-xl px-3 py-2 text-sm font-medium text-[#39465b] transition hover:bg-[#f7f0e8] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#bc6c5d]"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false)
                        signOutPending.current = true
                        fetcher.submit(
                          { intent: 'sign-out' },
                          { method: 'post', encType: 'application/json' },
                        )
                      }}
                      className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-[#8b6b62] transition hover:bg-[#fff1e8] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#bc6c5d]"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
            {!isAuthenticated && (
              <Link
                to="/profile"
                aria-label="Profile"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd4] bg-white/80 text-[#596579] shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8b3a9] hover:text-[#8d4c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
              >
                <UserRound aria-hidden="true" size={18} />
              </Link>
            )}
            <Link
              to="/settings"
              aria-label="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd4] bg-white/80 text-[#596579] shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8b3a9] hover:text-[#8d4c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
            >
              <Settings aria-hidden="true" size={18} />
            </Link>
          </nav>
        </header>

        {onePageLearningPath && (
          <OnePageLearningPlayer
            key={onePageLearningPath.selectedCourseId}
            learningPath={onePageLearningPath}
          />
        )}

        <section className="relative mt-8 overflow-hidden rounded-4xl border border-[#f0dfd1] bg-[#fffdf9] px-6 py-8 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] sm:px-10 sm:py-11">
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
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </main>
  )
}
