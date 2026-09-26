import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VirtualKeyboard from './VirtualKeyboard'

describe('VirtualKeyboard', () => {
  it('highlights the key matching nextKey.code', () => {
    render(<VirtualKeyboard nextKey={{ code: 'KeyR', shift: false }} showEnglishKeys opacity={1} />)
    expect(screen.getByText('ㄱ').closest('div')).toHaveClass('bg-amber-100')
  })

  it('highlights Shift when nextKey.shift is true', () => {
    render(<VirtualKeyboard nextKey={{ code: 'KeyQ', shift: true }} showEnglishKeys opacity={1} />)
    expect(screen.getByText('Shift')).toHaveClass('bg-amber-100')
  })

  it('highlights nothing when nextKey is undefined', () => {
    render(<VirtualKeyboard showEnglishKeys opacity={1} />)
    expect(screen.getByText('Shift')).not.toHaveClass('bg-amber-100')
    expect(screen.getByText('ㄱ').closest('div')).not.toHaveClass('bg-amber-100')
  })

  it('hides English key labels when showEnglishKeys is false', () => {
    render(<VirtualKeyboard showEnglishKeys={false} opacity={1} />)

    expect(screen.queryByText('r')).not.toBeInTheDocument()
  })

  it('applies an opacity of zero to the keyboard guide', () => {
    render(<VirtualKeyboard showEnglishKeys opacity={0} />)

    expect(screen.getByLabelText('Virtual Korean keyboard')).toHaveStyle({ opacity: '0' })
  })
})
