import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/routes'

// Response bodies are copied byte for byte from server/src/routes/catalogue.contract.test.ts.
// Mirror them if that file changes. The real api.ts functions run here; only fetch is stubbed.

const CATEGORY_PAGE_2 =
  '{"topRated":[],"products":[{"id":"16","title":"Lamp 16","category":"lighting"}],"page":2,"pageSize":12,"total":13}'
const SEARCH_PAGE_3 =
  '{"products":[{"id":"25","title":"Lamp 25","category":"other"},{"id":"26","title":"Lamp 26","category":"other"}],"page":3,"pageSize":12,"total":26}'
const EMPTY_SEARCH = '{"products":[],"page":1,"pageSize":12,"total":0}'

const json = (body: string) => new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })

function stubFetch(body: string) {
  const fn = vi.fn(async (url: string) => json(url === '/api/categories' ? '[]' : body))
  vi.stubGlobal('fetch', fn)
  return () => fn.mock.calls.map((c) => c[0]).filter((url) => url !== '/api/categories')
}

const renderAt = (url: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [url] })} />)

afterEach(() => vi.unstubAllGlobals())

describe('pages with the real api module and server-shaped paged responses', () => {
  it('category page 2 requests ?page=2 and shows the remaining product with page position', async () => {
    const requested = stubFetch(CATEGORY_PAGE_2)
    renderAt('/categories/lighting?page=2')
    expect(await screen.findByRole('link', { name: 'Lamp 16' })).toBeInTheDocument()
    expect(requested()).toEqual(['/api/categories/lighting/products?page=2'])
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Top rated' })).not.toBeInTheDocument()
  })

  it('search page 3 requests q and page=3 and shows the last two matches with page position', async () => {
    const requested = stubFetch(SEARCH_PAGE_3)
    renderAt('/search?q=lamp&page=3')
    expect(await screen.findByRole('link', { name: 'Lamp 26' })).toBeInTheDocument()
    expect(requested()).toEqual(['/api/products?q=lamp&page=3'])
    expect(screen.getByRole('link', { name: 'Lamp 25' })).toBeInTheDocument()
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '/search?q=lamp&page=2')
  })

  it('search sends neither page=abc nor a pageSize taken from the address bar', async () => {
    const requested = stubFetch(EMPTY_SEARCH)
    renderAt('/search?q=lamp&page=abc&pageSize=5')
    await screen.findByText('No products match "lamp"')
    expect(requested()).toEqual(['/api/products?q=lamp'])
  })

  it('category sends neither page=0 nor a pageSize taken from the address bar', async () => {
    const requested = stubFetch('{"topRated":[],"products":[],"page":1,"pageSize":12,"total":0}')
    renderAt('/categories/lighting?page=0&pageSize=5')
    await screen.findByText('No products in this category yet. Try another category.')
    expect(requested()).toEqual(['/api/categories/lighting/products'])
  })
})
