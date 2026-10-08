import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Dropdown } from './Dropdown'
import { Modal } from './Modal'

describe('shared UI primitives', () => {
  it('renders an accessible modal with its supplied content and a working close control', () => {
    const onClose = vi.fn()

    render(
      <Modal open title="Sign in" onClose={onClose}>
        <p>Welcome back</p>
      </Modal>,
    )

    expect(screen.getByRole('dialog', { name: 'Sign in' })).toHaveTextContent(
      'Welcome back',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps focus in its content when re-rendered with a new onClose', () => {
    const first = vi.fn()
    const latest = vi.fn()
    const view = render(
      <Modal open title="Create" onClose={first}>
        <input aria-label="Title" />
      </Modal>,
    )
    const input = screen.getByRole('textbox', { name: 'Title' })
    input.focus()

    view.rerender(
      <Modal open title="Create" onClose={latest}>
        <input aria-label="Title" />
      </Modal>,
    )
    expect(input).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(latest).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('does not render a closed modal into the accessibility tree', () => {
    render(
      <Modal open={false} title="Sign in" onClose={() => undefined}>
        <p>Welcome back</p>
      </Modal>,
    )

    expect(
      screen.queryByRole('dialog', { name: 'Sign in' }),
    ).not.toBeInTheDocument()
  })

  it('opens a themed dropdown list and reports the selected option', () => {
    const onChange = vi.fn()

    render(
      <Dropdown
        label="Meaning language"
        value="both"
        onChange={onChange}
        options={[
          { value: 'th', label: 'Thai' },
          { value: 'en', label: 'English' },
          { value: 'both', label: 'Both' },
        ]}
      />,
    )

    const trigger = screen.getByRole('button', {
      name: 'Meaning language: Both',
    })
    expect(trigger).toHaveTextContent('Both')

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Thai' }))

    expect(onChange).toHaveBeenCalledWith('th')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('keeps disabled button semantics', () => {
    render(<Button disabled>Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
