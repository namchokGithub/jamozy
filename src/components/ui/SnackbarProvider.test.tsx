import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SnackbarProvider, useSnackbar } from './SnackbarProvider'

function SnackbarControls() {
  const { showError, showSuccess } = useSnackbar()

  return (
    <div>
      <button type="button" onClick={() => showSuccess('Settings saved')}>
        Show success
      </button>
      <button
        type="button"
        onClick={() => showError('Could not save settings')}
      >
        Show error
      </button>
    </div>
  )
}

describe('SnackbarProvider', () => {
  it('announces a success message and lets the learner dismiss it', () => {
    render(
      <SnackbarProvider>
        <SnackbarControls />
      </SnackbarProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }))

    expect(screen.getByRole('status')).toHaveTextContent('Settings saved')

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('replaces a prior message with the latest error announcement', () => {
    render(
      <SnackbarProvider>
        <SnackbarControls />
      </SnackbarProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show error' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save settings',
    )
    expect(screen.queryByText('Settings saved')).not.toBeInTheDocument()
  })

  it('dismisses a notification after five seconds', () => {
    vi.useFakeTimers()
    try {
      render(
        <SnackbarProvider>
          <SnackbarControls />
        </SnackbarProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Show success' }))
      act(() => vi.advanceTimersByTime(5000))

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
