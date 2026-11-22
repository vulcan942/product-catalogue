import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

// After a Previous/Next click the new page remounts; move focus to the h1 and scroll to the top
// so keyboard and screen reader users start at the new results.
export function usePagedFocus() {
  const ref = useRef<HTMLHeadingElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const paged = (location.state as { paged?: boolean } | null)?.paged === true
  const { pathname, search } = location

  useEffect(() => {
    if (!paged) return
    ref.current?.focus()
    window.scrollTo(0, 0)
    // Clear the flag so a reload or Back/Forward to this entry does not steal focus again.
    navigate(pathname + search, { replace: true, state: null })
  }, [paged, navigate, pathname, search])

  return ref
}
