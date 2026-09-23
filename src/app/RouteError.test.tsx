import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import RouteError from './RouteError'
import { NotFoundError } from '../domain/errors'

describe('RouteError', () => {
  it('renders a distinct message for a NotFoundError', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: () => null,
          ErrorBoundary: RouteError,
          loader: async () => {
            throw new NotFoundError('Lesson not found: missing')
          },
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Not found.')).toBeInTheDocument()
  })

  it('renders the message of a thrown Error', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: () => null,
          ErrorBoundary: RouteError,
          loader: async () => {
            throw new Error('Firestore unavailable')
          },
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Firestore unavailable')).toBeInTheDocument()
  })

  it('renders a generic fallback for a non-Error throw', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: () => null,
          ErrorBoundary: RouteError,
          loader: async () => {
            throw 'unexpected'
          },
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument()
  })
})
