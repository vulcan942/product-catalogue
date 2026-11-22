import { Link, Outlet, useLocation, useSearchParams } from 'react-router'
import { CategoryNav } from '@/components/CategoryNav'
import { SearchBar } from '@/components/SearchBar'

// One string so the header brand and page content share the same column and padding.
const container = 'mx-auto w-full max-w-(--container-max) px-4 min-[600px]:px-8'

function SiteHeader() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const term = pathname === '/search' ? (params.get('q') ?? '').trim() : ''
  return (
    <header className="border-b border-border bg-background">
      <div className={`${container} flex flex-col gap-2 py-3 min-[960px]:flex-row min-[960px]:items-center min-[960px]:gap-4 min-[960px]:py-4`}>
        <Link
          to="/"
          className="flex min-h-11 items-center text-base leading-6 font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Catalogue
        </Link>
        <CategoryNav />
        <SearchBar key={term} defaultValue={term} className="mt-1 min-[960px]:mt-0 min-[960px]:ml-auto min-[960px]:shrink-0" />
      </div>
    </header>
  )
}

export function RootLayout() {
  return (
    <>
      <SiteHeader />
      <main className={`${container} py-8 min-[960px]:py-16`}>
        <Outlet />
      </main>
    </>
  )
}
