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
          loader: async () => ({ courses: [makeCourse('c1')] }),
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', { name: /Course c1/i })
    expect(link).toHaveAttribute('href', '/courses/c1')
    expect(screen.getByText('Description for c1')).toBeInTheDocument()
  })
})
