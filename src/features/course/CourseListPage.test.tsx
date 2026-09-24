import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import CourseListPage from './CourseListPage'
import type { Course } from '../../domain/models/course'

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

describe('CourseListPage', () => {
  it('renders each course as a link to its course map', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => ({ courses: [makeCourse('c1')], dueReviewCount: 0 }),
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
          loader: async () => ({ courses: [], dueReviewCount: 0 }),
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
          loader: async () => ({ courses: [], dueReviewCount: 3 }),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', { name: /3 words due for review/i })
    expect(link).toHaveAttribute('href', '/review')
  })

  it('hides the due-review link when nothing is due', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => ({ courses: [], dueReviewCount: 0 }),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    await screen.findByText('No courses yet.')
    expect(screen.queryByRole('link', { name: /words due for review/i })).not.toBeInTheDocument()
  })
})
