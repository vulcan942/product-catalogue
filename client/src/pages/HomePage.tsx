import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CategoryNav } from '@/components/CategoryNav'
import { ProductGrid } from '@/components/ProductGrid'
import { getFeatured } from '@/lib/api'
import type { Product } from '@/lib/product'

interface State {
  status: 'loading' | 'error' | 'ready'
  products: Product[]
}

export function HomePage() {
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading', products: [] })

  useEffect(() => {
    let cancelled = false
    getFeatured().then(
      (products) => !cancelled && setState({ status: 'ready', products }),
      () => !cancelled && setState({ status: 'error', products: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
    <section aria-labelledby="featured-heading" className="flex flex-col gap-4">
      <h2 id="featured-heading" className="text-xl leading-7 font-semibold">
        Featured products
      </h2>
      <ProductGrid
        products={state.products}
        status={state.status}
        onEnquire={(p) => navigate(`/products/${p.id}`)}
        renderTitle={(p) => (
          <Link
            to={`/products/${p.id}`}
            className="flex min-h-11 items-center hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="line-clamp-2">{p.title}</span>
          </Link>
        )}
        errorTitle="Featured products did not load"
        errorBody="We could not reach the catalogue. Check your connection and refresh the page to try again."
        emptyTitle="No featured products"
        emptyBody="No featured products right now. Try browsing a category."
      />
    </section>
    <CategoryNav heading="Browse categories" className="mt-8 min-[960px]:mt-12" />
    </>
  )
}
