import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VirtualKeyboard from './VirtualKeyboard'

describe('VirtualKeyboard', () => {
  it('highlights the key matching nextKey.code', () => {
    render(
      <VirtualKeyboard
        nextKey={{ code: 'KeyR', shift: false }}
        showEnglishKeys
        opacity={1}
      />,
    )
    expect(screen.getByLabelText('r')).toHaveClass('bg-[#ddf5e9]')
  })

  it('highlights Shift when nextKey.shift is true', () => {
    render(
      <VirtualKeyboard
        nextKey={{ code: 'KeyQ', shift: true }}
        showEnglishKeys
        opacity={1}
      />,
    )
    screen
      .getAllByLabelText('Shift ⇧')
      .forEach((key) => expect(key).toHaveClass('bg-[#fff0d8]'))
  })

  it('highlights nothing when nextKey is undefined', () => {
    render(<VirtualKeyboard showEnglishKeys opacity={1} />)
    screen
      .getAllByLabelText('Shift ⇧')
      .forEach((key) => expect(key).not.toHaveClass('bg-[#fff0d8]'))
    expect(screen.getByLabelText('r')).not.toHaveClass('bg-[#fff0d8]')
  })

  it('keeps the desktop key labels when mobileStyle is off', () => {
    render(<VirtualKeyboard showEnglishKeys opacity={1} />)
    expect(screen.getByLabelText('Tab')).toHaveTextContent(/^Tab$/)
    expect(screen.getByLabelText('q')).toHaveTextContent(/^ㅃㅂq$/)
  })

  it('adds a phone-style label set when mobileStyle is on', () => {
    render(<VirtualKeyboard showEnglishKeys opacity={1} mobileStyle />)
    expect(screen.getByLabelText('Tab')).toHaveTextContent(/^⇥Tab$/)
    expect(screen.getByLabelText('q')).toHaveTextContent(/^ㅃㅂㅂq$/)
  })

  it('shows shifted jamo on the phone-style label when Shift is needed', () => {
    render(
      <VirtualKeyboard
        nextKey={{ code: 'KeyQ', shift: true }}
        showEnglishKeys
        opacity={1}
        mobileStyle
      />,
    )
    expect(screen.getByLabelText('q')).toHaveTextContent(/^ㅃㅃㅂq$/)
  })

  it('hides English key labels when showEnglishKeys is false', () => {
    render(<VirtualKeyboard showEnglishKeys={false} opacity={1} />)

    expect(screen.queryByText('r')).not.toBeInTheDocument()
  })

  it('applies an opacity of zero to the keyboard guide', () => {
    render(<VirtualKeyboard showEnglishKeys opacity={0} />)

    expect(screen.getByLabelText('Virtual Korean keyboard')).toHaveStyle({
      opacity: '0',
    })
  })

  it('sends a touched jamo key through the supplied physical-key callback', () => {
    const onKeyPress = vi.fn()
    render(
      <VirtualKeyboard showEnglishKeys opacity={1} onKeyPress={onKeyPress} />,
    )

    fireEvent.click(screen.getByLabelText('r'))

    expect(onKeyPress).toHaveBeenCalledWith('KeyR', false)
  })

  it('sends Shift with the next touched jamo key', () => {
    const onKeyPress = vi.fn()
    render(
      <VirtualKeyboard showEnglishKeys opacity={1} onKeyPress={onKeyPress} />,
    )

    fireEvent.click(screen.getAllByLabelText('Shift ⇧')[0])
    fireEvent.click(screen.getByLabelText('q'))

    expect(onKeyPress).toHaveBeenCalledWith('KeyQ', true)
  })

  it('does not submit a punctuation key as typing input', () => {
    const onKeyPress = vi.fn()
    render(
      <VirtualKeyboard showEnglishKeys opacity={1} onKeyPress={onKeyPress} />,
    )

    fireEvent.click(screen.getByLabelText(','))

    expect(onKeyPress).not.toHaveBeenCalled()
  })
})
