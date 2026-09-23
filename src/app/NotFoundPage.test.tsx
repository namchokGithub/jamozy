import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import NotFoundPage from './NotFoundPage'

describe('NotFoundPage via a wildcard route', () => {
  it('renders when no route matches the URL', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', Component: () => null },
        { path: '*', Component: NotFoundPage },
      ],
      { initialEntries: ['/this-does-not-exist'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/Page not found/i)).toBeInTheDocument()
  })
})
