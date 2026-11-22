import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  to: (page: number) => string
}

const label = (text: string) => (
  <>
    {text}{' '}
    <span className="sr-only">page</span>
  </>
)

export function Pagination({ page, pageSize, total, to }: PaginationProps) {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-wrap items-center justify-between gap-3 gap-y-3 min-[600px]:justify-center min-[600px]:gap-6 min-[960px]:mt-12"
    >
      {page > 1 ? (
        <Button variant="secondary" asChild>
          <Link to={to(page - 1)} state={{ paged: true }} rel="prev">
            {label('Previous')}
          </Link>
        </Button>
      ) : (
        <Button variant="secondary" disabled>
          {label('Previous')}
        </Button>
      )}
      <span className="flex min-h-11 items-center text-sm font-semibold text-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Button variant="secondary" asChild>
          <Link to={to(page + 1)} state={{ paged: true }} rel="next">
            {label('Next')}
          </Link>
        </Button>
      ) : (
        <Button variant="secondary" disabled>
          {label('Next')}
        </Button>
      )}
    </nav>
  )
}
