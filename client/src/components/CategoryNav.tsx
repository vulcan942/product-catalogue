import { useEffect, useId, useState } from 'react'
import { NavLink } from 'react-router'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getCategories } from '@/lib/api'

interface CategoryNavProps {
  className?: string
  heading?: string
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; categories: string[] }

const listClass = 'flex flex-wrap gap-2'

export function CategoryNav({ className, heading }: CategoryNavProps) {
  const headingId = useId()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getCategories().then(
      (categories) => !cancelled && setState({ status: 'ready', categories }),
      () => !cancelled && setState({ status: 'error' }),
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'ready' && state.categories.length === 0) return null

  let body
  if (state.status === 'loading') {
    body = (
      <div role="status" aria-busy="true" aria-label="Loading categories">
        <ul className={listClass} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-11 w-24 rounded-sm bg-muted" />
          ))}
        </ul>
      </div>
    )
  } else if (state.status === 'error') {
    body = (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Categories did not load</AlertTitle>
        <AlertDescription>Refresh the page to try again.</AlertDescription>
      </Alert>
    )
  } else {
    body = (
      <ul className={listClass}>
        {state.categories.map((name) => (
          <li key={name}>
            <Button
              asChild
              variant="ghost"
              className="aria-[current=page]:bg-accent aria-[current=page]:underline"
            >
              <NavLink to={`/categories/${encodeURIComponent(name)}`}>
                <span className="first-letter:uppercase">{name}</span>
              </NavLink>
            </Button>
          </li>
        ))}
      </ul>
    )
  }

  // The loading list and error notice sit inside the nav so the landmark is stable across states.
  if (heading) {
    return (
      <div className={className}>
        <h2 id={headingId} className="mb-4 text-xl leading-7 font-semibold">
          {heading}
        </h2>
        <nav aria-labelledby={headingId}>{body}</nav>
      </div>
    )
  }
  return (
    <nav aria-label="Categories" className={className}>
      {body}
    </nav>
  )
}
