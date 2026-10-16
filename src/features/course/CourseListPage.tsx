import { Suspense, useEffect, useRef, useState } from 'react'
import { Await, Link, useFetcher, useLoaderData } from 'react-router'
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
import type { Course } from '../../domain/models/course'
import mascot from '../../assets/jamozy-mascot.png'
import { AuthModal } from '../auth/AuthModal'
import { Button } from '../../components/ui/Button'
import { useSnackbar } from '../../components/ui/SnackbarProvider'
import OnePageLearningPlayer from '../home/OnePageLearningPlayer'
import HomePlayer from '../home/HomePlayer'
import HomePlayerSkeleton from '../home/HomePlayerSkeleton'
import { SiteFooter } from '../../components/ui/SiteFooter'
import { QuickSettingsModal } from '../settings/QuickSettingsModal'
import type { UserSettings } from '../../domain/models/user-profile'

type CourseListActionData = {
  displayName?: string
  authenticated?: boolean
  error?: string
}

export default function CourseListPage() {
  const { page, homePlayer, homeProgress, onePageLearningPath, settings } =
    useLoaderData() as CourseListLoaderData

  return (
    <main className="flex min-h-dvh flex-col overflow-hidden bg-page px-4 py-5 text-ink sm:px-6 sm:py-8 select-none!">
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-blush/50 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-sage/50 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral-500"
          >
            <img
              src="/templates/jamozy-hanguk-180x180.png"
              alt=""
              className="h-11 w-11 object-contain sm:h-15 sm:w-15"
            />
            <span className="text-xl font-bold tracking-tight">Jamozy</span>
          </Link>

          {/* Account details come from Firestore; the rest of the page does
              not wait for them. */}
          <Suspense fallback={<AccountNavPlaceholder />}>
            <Await resolve={page}>
              {({ displayName, isAuthenticated }) => (
                <AccountNav
                  displayName={displayName}
                  isAuthenticated={isAuthenticated}
                  settings={settings}
                />
              )}
            </Await>
          </Suspense>
        </header>

        {/* home.json and the device cache load almost at once, so the Home
            player needs no skeleton; only the Firestore fallback shows one. */}
        <Suspense fallback={null}>
          <Await resolve={homePlayer}>
            {(player) =>
              player ? (
                <HomePlayer
                  key={player.content.exportedAt}
                  data={player}
                  liveProgress={homeProgress}
                  settings={settings}
                />
              ) : (
                <Suspense fallback={<HomePlayerSkeleton />}>
                  <Await resolve={onePageLearningPath}>
                    {(learningPath) =>
                      learningPath && (
                        <OnePageLearningPlayer
                          key={learningPath.selectedCourseId}
                          learningPath={learningPath}
                          settings={settings}
                        />
                      )
                    }
                  </Await>
                </Suspense>
              )
            }
          </Await>
        </Suspense>

        <section className="relative mt-5 overflow-hidden rounded-4xl border border-line-soft bg-card px-6 py-8 shadow-panel sm:px-10 sm:py-11 select-none!">
          <div
            className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-peach-100/50"
            aria-hidden="true"
          />
          <div className="relative max-w-xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-coral-600">
              <Sparkles aria-hidden="true" size={16} />
              YOUR KOREAN CORNER
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Learn Hangul, at your pace.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted sm:text-lg">
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

        <Suspense fallback={<LearningPathPlaceholder />}>
          <Await resolve={page}>
            {({ courses, dueReviewCount }) => (
              <LearningPathSection
                courses={courses}
                dueReviewCount={dueReviewCount}
              />
            )}
          </Await>
        </Suspense>
        <SiteFooter />
      </div>
    </main>
  )
}

function AccountNav({
  displayName,
  isAuthenticated,
  settings,
}: {
  displayName: string
  isAuthenticated: boolean
  settings: Promise<UserSettings>
}) {
  const fetcher = useFetcher<CourseListActionData>()
  const { showError, showSuccess } = useSnackbar()
  const name = fetcher.data?.displayName ?? displayName
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [showAuth, setShowAuth] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showQuickSettings, setShowQuickSettings] = useState(false)
  const signOutPending = useRef(false)

  useEffect(() => {
    if (signOutPending.current && fetcher.state === 'idle' && fetcher.data) {
      signOutPending.current = false
      if (fetcher.data.error) showError(fetcher.data.error)
      else showSuccess('Signed out successfully')
    }
  }, [fetcher.data, fetcher.state, showError, showSuccess])

  return (
    <>
      <nav
        className="flex items-center gap-1.5 select-none! sm:gap-2"
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
              className="flex items-center gap-1 rounded-full border border-line bg-surface/80 px-3 py-2 text-sm shadow-sm"
            >
              <span className="hidden sm:inline">{name}</span>
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
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                setUserMenuOpen(false)
              }
            }}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-2 text-sm font-medium text-ink-soft shadow-sm transition hover:border-line-hover hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
                <UserRound aria-hidden="true" size={13} />
              </span>
              <span className="hidden max-w-32 truncate sm:inline">{name}</span>
              <ChevronDown
                aria-hidden="true"
                size={15}
                className={`transition ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-2 w-36 rounded-2xl border border-line bg-card p-1.5 shadow-popover"
              >
                <Link
                  to="/profile"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-coral-500"
                >
                  Profile
                </Link>
                <Link
                  to="/review"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-coral-500"
                >
                  Review
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
                  className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-coral-700 transition hover:bg-coral-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-coral-500"
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
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/80 text-ink-muted shadow-sm transition hover:-translate-y-0.5 hover:border-line-hover hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500"
          >
            <UserRound aria-hidden="true" size={18} />
          </Link>
        )}
        <div className="relative">
          <button
            type="button"
            aria-label="Settings"
            aria-expanded={showQuickSettings}
            onClick={() => setShowQuickSettings((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/80 text-ink-muted shadow-sm transition hover:-translate-y-0.5 hover:border-line-hover hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500"
          >
            <Settings aria-hidden="true" size={18} />
          </button>
          {showQuickSettings && (
            <Suspense fallback={null}>
              <Await resolve={settings}>
                {(loadedSettings) => (
                  <QuickSettingsModal
                    settings={loadedSettings}
                    onClose={() => setShowQuickSettings(false)}
                  />
                )}
              </Await>
            </Suspense>
          )}
        </div>
      </nav>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}

function AccountNavPlaceholder() {
  return (
    <div className="flex gap-2" aria-hidden="true">
      <div className="h-10 w-24 animate-pulse rounded-full bg-lavender-100" />
      <div className="h-10 w-10 animate-pulse rounded-full bg-lavender-100" />
    </div>
  )
}

function LearningPathSection({
  courses,
  dueReviewCount,
}: {
  courses: Course[]
  dueReviewCount: number
}) {
  return (
    <>
      {dueReviewCount > 0 && (
        <Link
          to="/review"
          className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-peach-100 bg-peach-50 px-5 py-4 text-peach-700 transition hover:-translate-y-0.5 hover:bg-peach-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500"
        >
          <span className="flex items-center gap-3 text-sm font-semibold select-none!">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/70">
              <BookOpen aria-hidden="true" size={18} />
            </span>
            {dueReviewCount} words due for review · ready when you are
          </span>
          <ArrowUpRight aria-hidden="true" size={18} />
        </Link>
      )}

      <section
        className="mt-10  select-none!"
        aria-labelledby="learning-path-heading"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-coral-600">
              START WHERE YOU ARE
            </p>
            <h2
              id="learning-path-heading"
              className="mt-1 text-2xl font-bold tracking-tight text-ink"
            >
              Your learning path
            </h2>
          </div>
          {courses.length > 0 && (
            <span className="rounded-full bg-surface/70 px-3 py-1.5 text-sm font-medium text-muted">
              {courses.length} {courses.length === 1 ? 'course' : 'courses'}
            </span>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
            <Flower2
              className="mx-auto text-coral-300"
              aria-hidden="true"
              size={28}
            />
            <p className="mt-3 font-semibold text-ink-soft">
              Your courses will bloom here.
            </p>
            <p className="mt-1 text-sm text-muted">No courses yet.</p>
            <p className="mt-1 text-sm text-muted">
              Check back soon for your next lesson.
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {courses.map((course, index) => (
              <li key={course.id}>
                <Link
                  to={`/courses/${course.id}`}
                  className="group flex h-full min-h-48 flex-col rounded-3xl border border-line bg-card/85 p-6 shadow-card transition duration-200 hover:-translate-y-1 hover:border-line-hover hover:shadow-[0_20px_35px_-24px_rgba(145,93,76,0.45)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral-500"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lavender-200 text-lavender-600">
                      <span className="text-sm font-bold">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="text-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral-600"
                      aria-hidden="true"
                      size={20}
                    />
                  </div>
                  <div className="mt-auto pt-8">
                    <h3 className="text-xl font-bold tracking-tight text-ink">
                      {course.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {course.description}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function LearningPathPlaceholder() {
  return (
    <div
      className="mt-10 grid gap-4 sm:grid-cols-2 select-none!"
      aria-hidden="true"
    >
      <div className="h-48 animate-pulse rounded-3xl bg-surface/70" />
      <div className="h-48 animate-pulse rounded-3xl bg-surface/70" />
    </div>
  )
}
