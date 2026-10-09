import { useEffect, useState } from 'react'

export function usePressedKeyCodes(): ReadonlySet<string> {
  const [pressedCodes, setPressedCodes] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  useEffect(() => {
    const setPressed = (code: string, pressed: boolean) => {
      setPressedCodes((current) => {
        if (current.has(code) === pressed) return current
        const next = new Set(current)
        if (pressed) next.add(code)
        else next.delete(code)
        return next
      })
    }
    const clearPressed = () => setPressedCodes(new Set())
    const handleKeyDown = (event: KeyboardEvent) => setPressed(event.code, true)
    const handleKeyUp = (event: KeyboardEvent) => setPressed(event.code, false)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') clearPressed()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearPressed)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearPressed)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return pressedCodes
}
