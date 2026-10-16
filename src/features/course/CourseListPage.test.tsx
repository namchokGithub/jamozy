import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import CourseListPage from './CourseListPage'
import type { Course } from '../../domain/models/course'
import type { UserSettings } from '../../domain/models/user-profile'

function makeCourse(id: string): Course {
  return {
    id,
    title: `Course ${id}`,
    description: `Description for ${id}`,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Mirrors CourseListLoaderData: page data streams in as a promise.
function pageData(courses: Course[], dueReviewCount: number) {
  return {
    page: Promise.resolve({
      courses,
      dueReviewCount,
      displayName: 'Guest',
      isAuthenticated: false,
    }),
    settings: Promise.resolve(defaultSettings()),
  }
}

function defaultSettings(): UserSettings {
  return {
    soundEnabled: true,
    keyboardSoundPack: 'turquoise',
    showKeyboard: true,
    showEnglishKeys: true,
    keyboardOpacity: 1,
    romanizationEnabled: true,
    meaningLanguage: 'both',
    theme: 'light',
  }
}

describe('CourseListPage', () => {
  it('presents a welcoming hero and learning-path section around the course links', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => pageData([makeCourse('c1')], 0),
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole('heading', {
        name: /learn hangul, at your pace/i,
      }),
    ).toBeInTheDocument()
    // The learning-path section streams in after the static hero.
    expect(
      await screen.findByRole('heading', { name: /your learning path/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /course c1/i })).toHaveAttribute(
      'href',
      '/courses/c1',
    )
  })

  it('renders each course as a link to its course map', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => pageData([makeCourse('c1')], 0),
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', { name: /Course c1/i })
    expect(link).toHaveAttribute('href', '/courses/c1')
    expect(screen.getByText('Description for c1')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no courses yet', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => pageData([], 0),
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('No courses yet.')).toBeInTheDocument()
  })

  it('shows a due-review link when items are due', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => pageData([], 3),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', {
      name: /3 words due for review/i,
    })
    expect(link).toHaveAttribute('href', '/review')
  })

  it('hides the due-review link when nothing is due', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => pageData([], 0),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    await screen.findByText('No courses yet.')
    expect(
      screen.queryByRole('link', { name: /words due for review/i }),
    ).not.toBeInTheDocument()
  })

  it('opens quick settings and links to the full settings page', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => pageData([], 0),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))

    expect(
      await screen.findByRole('dialog', { name: 'Quick settings' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open all settings →' }),
    ).toHaveAttribute('href', '/settings')
  })

  it('always shows a Profile link', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => pageData([], 0),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', { name: 'Profile' })
    expect(link).toHaveAttribute('href', '/profile')
  })

  it('closes the sign-in modal when revalidation confirms authentication', async () => {
    let isAuthenticated = false
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => ({
            page: Promise.resolve({
              courses: [],
              dueReviewCount: 0,
              displayName: 'Learner',
              isAuthenticated,
            }),
            settings: Promise.resolve(defaultSettings()),
          }),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument()

    isAuthenticated = true
    await act(async () => {
      router.revalidate()
    })

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Sign in' }),
      ).not.toBeInTheDocument(),
    )
  })
})
