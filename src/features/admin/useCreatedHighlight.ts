import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

export function useCreatedHighlight(): boolean {
  const location = useLocation()
  const [highlight, setHighlight] = useState(
    Boolean((location.state as { created?: boolean } | null)?.created),
  )
  useEffect(() => {
    if (!highlight) return
    const timer = window.setTimeout(() => setHighlight(false), 1800)
    return () => window.clearTimeout(timer)
  }, [highlight])
  return highlight
}
