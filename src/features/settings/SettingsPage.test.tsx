import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import SettingsPage from './SettingsPage'
import type { UserSettings } from '../../domain/models/user-profile'
import type { SettingsActionData } from './SettingsPage.action'
import { SnackbarProvider } from '../../components/ui/SnackbarProvider'

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    soundEnabled: true,
    keyboardSoundPack: 'turquoise',
    showKeyboard: true,
    showEnglishKeys: true,
    keyboardOpacity: 1,
    romanizationEnabled: true,
    meaningLanguage: 'both',
    theme: 'light',
    ...overrides,
  }
}

function renderPage(
  settings: UserSettings = makeSettings(),
  action: (args: {
    request: Request
  }) => Promise<SettingsActionData> = async () => settings,
) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: SettingsPage,
        loader: async () => ({ settings }),
        action,
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <SnackbarProvider>
      <RouterProvider router={router} />
    </SnackbarProvider>,
  )
}

describe('SettingsPage', () => {
  it('renders every field seeded from the loaded settings', async () => {
    renderPage(makeSettings({ theme: 'dark', meaningLanguage: 'th', keyboardSoundPack: 'mxblack' }))

    expect(await screen.findByLabelText('Sound')).toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Theme: Dark' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Meaning language: Thai' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Keyboard sound: Cherry MX Blacks' }),
    ).toBeInTheDocument()
  })

  it('shows sound packs in the specified order and submits the selected pack', async () => {
    let submitted: UserSettings | undefined
    renderPage(makeSettings(), async ({ request }) => {
      submitted = await request.json() as UserSettings
      return submitted
    })

    const trigger = await screen.findByRole('button', { name: 'Keyboard sound: Turquoise Tealio' })
    fireEvent.click(trigger)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Turquoise Tealio',
      'Cherry MX Blacks',
      'Cherry MX Blues',
    ])

    fireEvent.click(screen.getByRole('option', { name: 'Cherry MX Blues' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(submitted?.keyboardSoundPack).toBe('mxblue'))
  })

  it('links back to the course list', async () => {
    renderPage()

    expect(await screen.findByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('shows boolean settings as switches', async () => {
    renderPage()

    expect(await screen.findByRole('switch', { name: 'Sound' })).toBeChecked()
  })

  it('disables Save while submitting and announces success once it succeeds', async () => {
    let resolveAction: (settings: UserSettings) => void
    const action = vi.fn(
      () =>
        new Promise<UserSettings>((resolve) => {
          resolveAction = resolve
        }),
    )
    renderPage(makeSettings(), action)
    await screen.findByLabelText('Sound')

    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)

    await waitFor(() => expect(saveButton).toBeDisabled())
    resolveAction!(makeSettings())

    await waitFor(() => expect(saveButton).not.toBeDisabled())
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Settings saved',
    )
  })

  it('shows Saved once the post-action loader revalidation finishes, not just the action', async () => {
    // React Router's fetcher state machine goes submitting -> loading (revalidating
    // this route's own loader after a successful action) -> idle. A fast-resolving
    // fake loader/action can let React batch "loading" and "idle" into a single
    // render, hiding a bug that only tracks the "submitting" phase. Controlling both
    // promises independently forces "loading" to be its own observed render, the
    // same way a real (slower) Firestore round trip does.
    let resolveAction: (settings: UserSettings) => void
    let resolveRevalidation:
      ((data: { settings: UserSettings }) => void) | undefined
    let loaderCallCount = 0
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: SettingsPage,
          loader: () =>
            new Promise<{ settings: UserSettings }>((resolve) => {
              loaderCallCount += 1
              if (loaderCallCount === 1) {
                resolve({ settings: makeSettings() })
              } else {
                resolveRevalidation = resolve
              }
            }),
          action: () =>
            new Promise<UserSettings>((resolve) => {
              resolveAction = resolve
            }),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(
      <SnackbarProvider>
        <RouterProvider router={router} />
      </SnackbarProvider>,
    )
    await screen.findByLabelText('Sound')

    // Edit a field first — without this, `settings` still equals the untouched
    // `savedSnapshot` by coincidence, and "Saved" would show as soon as
    // fetcher.data is set (right when the action resolves), independent of
    // whether the snapshot-tracking effect works at all.
    fireEvent.click(screen.getByLabelText('Sound'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    resolveAction!({ ...makeSettings(), soundEnabled: false })

    await waitFor(() => expect(loaderCallCount).toBe(2))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    resolveRevalidation!({
      settings: { ...makeSettings(), soundEnabled: false },
    })

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Settings saved',
    )
  })

  it('announces success even when the loaded settings and the saved-back settings have different key orders', async () => {
    // The loader's settings come from Firestore (whatever field order the
    // repository mapper produces); the action's returned settings come from
    // userSettingsSchema.parse(), which always emits keys in the schema's
    // own definition order. Both can hold the exact same values with a
    // different key insertion order — a JSON.stringify-based equality check
    // would wrongly treat those as different.
    const loadedSettings = {
      theme: 'light',
      romanizationEnabled: true,
      meaningLanguage: 'both',
      showEnglishKeys: true,
      soundEnabled: true,
      keyboardSoundPack: 'turquoise',
      showKeyboard: true,
      keyboardOpacity: 1,
    } as UserSettings
    const savedBackSettings = {
      soundEnabled: true,
      keyboardSoundPack: 'turquoise',
      showKeyboard: true,
      showEnglishKeys: true,
      keyboardOpacity: 1,
      romanizationEnabled: true,
      meaningLanguage: 'both',
      theme: 'light',
    } as UserSettings

    renderPage(loadedSettings, async () => savedBackSettings)
    await screen.findByLabelText('Sound')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Settings saved',
    )
  })

  it('keeps settings editable after a failed save and announces the failure', async () => {
    renderPage(makeSettings(), async () => ({
      error: 'Could not save settings',
    }))
    await screen.findByLabelText('Sound')

    fireEvent.click(screen.getByLabelText('Sound'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save settings',
    )
    expect(screen.getByLabelText('Sound')).not.toBeChecked()
  })

  it('keeps settings editable after a successful save', async () => {
    renderPage(makeSettings())
    await screen.findByLabelText('Sound')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Settings saved',
    )

    expect(screen.getByLabelText('Sound')).toBeEnabled()
  })
})
