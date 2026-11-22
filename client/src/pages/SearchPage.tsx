import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AlertCircle, Info } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { ProductGrid } from '@/components/ProductGrid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ApiError, searchProducts } from '@/lib/api'
import { parsePage } from '@/lib/parsePage'
import { usePagedFocus } from '@/lib/usePagedFocus'
import type { Product } from '@/lib/product'

type State =
  | { status: 'loading' | 'error' }
  | { status: 'invalid'; message: string }
  | { status: 'ready'; products: Product[]; pageSize: number; total: number }

const h1Class = 'mb-6 text-heading-lg font-bold'

// Keyed by term so a new search resets to loading without setState in the effect.
export function SearchPage() {
  const [params] = useSearchParams()
  const term = (params.get('q') ?? '').trim()

  useEffect(() => {
    document.title = 'Search - Catalogue'
    return () => {
      document.title = 'Catalogue'
    }
  }, [])

  if (!term) {
    return (
      <>
        <h1 className={h1Class}>Search products</h1>
        <Alert>
          <Info />
          <AlertTitle>No search term</AlertTitle>
          <AlertDescription>Enter a word to search for.</AlertDescription>
        </Alert>
      </>
    )
  }
  const page = parsePage(params.get('page'))
  return <SearchResults key={`${term}:${page}`} term={term} page={page} />
}

function SearchResults({ term, page }: { term: string; page: number }) {
  const navigate = useNavigate()
  const h1Ref = usePagedFocus()
  const [state, setState] = useState<State>({ status: 'loading' })
  const to = (n: number) => `/search?q=${encodeURIComponent(term)}${n > 1 ? `&page=${n}` : ''}`

  useEffect(() => {
    let cancelled = false
    searchProducts(term, page).then(
      ({ products, pageSize, total }) => !cancelled && setState({ status: 'ready', products, pageSize, total }),
      (err: unknown) => {
        if (cancelled) return
        const message = err instanceof ApiError && err.status === 400 ? err.fields?.q : undefined
        setState(message ? { status: 'invalid', message } : { status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [term, page])

  const onEnquire = (p: Product) => navigate(`/products/${p.id}`)
  const renderTitle = (p: Product) => (
    <Link
      to={`/products/${p.id}`}
      className="flex min-h-11 items-center hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="line-clamp-2">{p.title}</span>
    </Link>
  )

  let body
  if (state.status === 'invalid') {
    body = (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Search did not run</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    )
  } else if (state.status !== 'ready') {
    body = <ProductGrid products={[]} status={state.status} onEnquire={onEnquire} />
  } else if (page > 1 && state.products.length === 0) {
    body = (
      <>
        <Alert>
          <Info />
          <AlertDescription>That page does not exist.</AlertDescription>
        </Alert>
        <Button asChild variant="secondary" className="mt-4">
          <Link to={to(1)}>Go to the first page</Link>
        </Button>
      </>
    )
  } else if (state.products.length === 0) {
    body = (
      <ProductGrid
        products={[]}
        status="ready"
        onEnquire={onEnquire}
        emptyTitle={`No products match "${term}"`}
        emptyBody="Try a different word or browse a category."
      />
    )
  } else {
    body = (
      <>
        <h2 className="sr-only">Matching products</h2>
        <ProductGrid products={state.products} status="ready" onEnquire={onEnquire} renderTitle={renderTitle} />
        <Pagination page={page} pageSize={state.pageSize} total={state.total} to={to} />
      </>
    )
  }

  return (
    <div className="[overflow-wrap:anywhere]">
      <h1 ref={h1Ref} tabIndex={-1} className={h1Class}>
        Results for &quot;{term}&quot;
      </h1>
      {body}
    </div>
  )
}
