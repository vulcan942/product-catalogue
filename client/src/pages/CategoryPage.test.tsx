import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getCategories, getCategoryPage, type CategoryPage as CategoryData } from '@/lib/api'
import { routes } from '@/routes'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getCategories: vi.fn().mockResolvedValue([]),
  getCategoryPage: vi.fn(),
}))

const mocked = vi.mocked(getCategoryPage)
vi.mocked(getCategories).mockResolvedValue([])

const item = (id: number, title: string) => ({ id, title, price: 10, image: '', category: 'electronics' })
const page = (topRated: CategoryData['topRated'], products: CategoryData['products']): CategoryData => ({
  topRated,
  products,
  page: 1,
  pageSize: 20,
  total: topRated.length + products.length,
})

const renderCategory = () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/categories/electronics'] })
  return render(<RouterProvider router={router} />)
}

describe('CategoryPage', () => {
  it('shows Top rated before More in this category, each with its products', async () => {
    mocked.mockResolvedValue(page([item(1, 'Drive')], [item(2, 'Monitor')]))
    renderCategory()
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['Top rated', 'More in this category'])
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('electronics')
    expect(screen.getByRole('link', { name: 'Monitor' })).toHaveAttribute('href', '/products/2')
    expect(mocked).toHaveBeenCalledWith('electronics', 1)
  })

  it('hides the More heading when only top rated products exist', async () => {
    mocked.mockResolvedValue(page([item(1, 'Drive')], []))
    renderCategory()
    expect(await screen.findByRole('heading', { name: 'Top rated' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'More in this category' })).not.toBeInTheDocument()
  })

  it('shows a loading grid without section headings while loading', () => {
    mocked.mockReturnValue(new Promise(() => {}))
    renderCategory()
    expect(screen.getByLabelText('Loading products')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('shows the empty copy when the category has no products', async () => {
    mocked.mockResolvedValue(page([], []))
    renderCategory()
    expect(await screen.findByText('No products in this category yet. Try another category.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('shows the not found notice for an unknown category', async () => {
    mocked.mockRejectedValue(new ApiError(404, 'not_found', 'nope'))
    renderCategory()
    expect(await screen.findByText('Category not found')).toBeInTheDocument()
    expect(screen.getByText('We could not find that category. Choose one from the menu.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Category not found')
  })

  it('sets the document title to the category and resets it on leaving', async () => {
    mocked.mockResolvedValue(page([item(1, 'Drive')], []))
    const { unmount } = renderCategory()
    await screen.findByRole('heading', { name: 'Top rated' })
    expect(document.title).toBe('electronics - Catalogue')
    unmount()
    expect(document.title).toBe('Catalogue')
  })

  it('keeps the category name as typed and relies on CSS to capitalise only the first letter', async () => {
    mocked.mockResolvedValue(page([], []))
    const router = createMemoryRouter(routes, { initialEntries: ["/categories/men's%20clothing"] })
    render(<RouterProvider router={router} />)
    const h1 = await screen.findByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent("men's clothing")
    expect(h1).toHaveClass('first-letter:uppercase')
  })

  it('shows the error notice when the request fails', async () => {
    mocked.mockRejectedValue(new ApiError(500, 'server_error', 'boom'))
    renderCategory()
    expect(await screen.findByRole('alert')).toHaveTextContent('Products did not load')
  })

  it('opens the category page when a nav link is clicked', async () => {
    vi.mocked(getCategories).mockResolvedValue(['electronics', 'jewelery'])
    mocked.mockResolvedValue(page([item(1, 'Drive')], []))
    const router = createMemoryRouter(routes, { initialEntries: ['/categories/electronics'] })
    render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { name: 'Top rated' })
    mocked.mockResolvedValue(page([item(9, 'Ring')], []))
    await userEvent.click(await screen.findByRole('link', { name: 'jewelery' }))
    expect(router.state.location.pathname).toBe('/categories/jewelery')
    expect(await screen.findByRole('link', { name: 'Ring' })).toBeInTheDocument()
    expect(mocked).toHaveBeenLastCalledWith('jewelery', 1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('jewelery')
    vi.mocked(getCategories).mockResolvedValue([])
  })
})

describe('CategoryPage pagination', () => {
  const paged = (n: number, total: number, topRated: CategoryData['topRated'], products: CategoryData['products']) => ({
    topRated,
    products,
    page: n,
    pageSize: 20,
    total,
  })
  const renderAt = (url: string) => {
    const router = createMemoryRouter(routes, { initialEntries: [url] })
    render(<RouterProvider router={router} />)
    return router
  }
  const scrollTo = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('scrollTo', scrollTo)
    scrollTo.mockClear()
    mocked.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows no pagination for a single page', async () => {
    mocked.mockResolvedValue(paged(1, 20, [item(1, 'Drive')], [item(2, 'Monitor')]))
    renderAt('/categories/electronics')
    await screen.findByRole('link', { name: 'Monitor' })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('shows page position with a Next link and a disabled Previous on page 1', async () => {
    mocked.mockResolvedValue(paged(1, 100, [item(1, 'Drive')], [item(2, 'Monitor')]))
    renderAt('/categories/electronics')
    await screen.findByText('Page 1 of 5')
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/categories/electronics?page=2')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })

  it('links Previous to page 1 without a page param and Next to page 3', async () => {
    mocked.mockResolvedValue(paged(2, 100, [], [item(2, 'Monitor')]))
    renderAt('/categories/electronics?page=2')
    await screen.findByText('Page 2 of 5')
    expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '/categories/electronics')
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/categories/electronics?page=3')
  })

  it('disables Next on the last page', async () => {
    mocked.mockResolvedValue(paged(5, 100, [], [item(2, 'Monitor')]))
    renderAt('/categories/electronics?page=5')
    await screen.findByText('Page 5 of 5')
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Next page' })).not.toBeInTheDocument()
  })

  it('loads page 2 and focuses the heading when Next is clicked', async () => {
    mocked.mockResolvedValueOnce(paged(1, 100, [item(1, 'Drive')], [item(2, 'Monitor')]))
    renderAt('/categories/electronics')
    await screen.findByText('Page 1 of 5')
    let release!: (v: CategoryData) => void
    mocked.mockReturnValueOnce(new Promise<CategoryData>((r) => (release = r)))
    await userEvent.click(screen.getByRole('link', { name: 'Next page' }))
    expect(await screen.findByLabelText('Loading products')).toBeInTheDocument()
    release(paged(2, 100, [], [item(3, 'Cable')]))
    expect(await screen.findByRole('link', { name: 'Cable' })).toBeInTheDocument()
    expect(mocked).toHaveBeenLastCalledWith('electronics', 2)
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it.each(['abc', '0', '-1', '1.5'])('requests page 1 for ?page=%s', async (bad) => {
    mocked.mockResolvedValue(paged(1, 0, [item(1, 'Drive')], []))
    renderAt(`/categories/electronics?page=${bad}`)
    await screen.findByRole('heading', { name: 'Top rated' })
    expect(mocked).toHaveBeenCalledWith('electronics', 1)
  })

  it('omits Top rated on page 2 but keeps More in this category', async () => {
    mocked.mockResolvedValue(paged(2, 100, [], [item(3, 'Cable')]))
    renderAt('/categories/electronics?page=2')
    expect(await screen.findByRole('heading', { name: 'More in this category' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Top rated' })).not.toBeInTheDocument()
  })

  it('says the page does not exist past the end, with a link to page 1 and no pagination', async () => {
    mocked.mockResolvedValue(paged(2, 3, [], []))
    renderAt('/categories/electronics?page=2')
    expect(await screen.findByText('That page does not exist.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the first page' })).toHaveAttribute('href', '/categories/electronics')
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
    expect(screen.queryByText('No products in this category yet. Try another category.')).not.toBeInTheDocument()
  })

  it('keeps the empty copy for an empty category on page 1', async () => {
    mocked.mockResolvedValue(paged(1, 0, [], []))
    renderAt('/categories/electronics')
    expect(await screen.findByText('No products in this category yet. Try another category.')).toBeInTheDocument()
    expect(screen.queryByText('That page does not exist.')).not.toBeInTheDocument()
  })
})

describe('CategoryPage pagination edges', () => {
  const at = (n: number, total: number, topRated: CategoryData['topRated'], products: CategoryData['products']): CategoryData => ({
    topRated,
    products,
    page: n,
    pageSize: 12,
    total,
  })
  const three = [item(1, 'A'), item(2, 'B'), item(3, 'C')]
  const many = (n: number) => Array.from({ length: n }, (_, i) => item(10 + i, `Item ${i}`))
  const renderAt = (url: string) => {
    const router = createMemoryRouter(routes, { initialEntries: [url] })
    render(<RouterProvider router={router} />)
    return router
  }
  const scrollTo = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('scrollTo', scrollTo)
    scrollTo.mockClear()
    mocked.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  async function tabStops() {
    const stops: Array<Element | null> = []
    for (let i = 0; i < 40; i++) {
      await userEvent.tab()
      stops.push(document.activeElement)
    }
    return stops
  }

  it('shows no pagination and no past-the-end notice for exactly three products', async () => {
    mocked.mockResolvedValue(at(1, 0, three, []))
    renderAt('/categories/electronics')
    await screen.findByRole('heading', { name: 'Top rated' })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
    expect(screen.queryByText('That page does not exist.')).not.toBeInTheDocument()
  })

  it('shows no pagination for 13 products, where 10 follow the top three', async () => {
    mocked.mockResolvedValue(at(1, 10, three, many(10)))
    renderAt('/categories/electronics')
    await screen.findByRole('heading', { name: 'More in this category' })
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument()
  })

  it('shows no pagination for 15 products, where 12 follow the top three', async () => {
    mocked.mockResolvedValue(at(1, 12, three, many(12)))
    renderAt('/categories/electronics')
    await screen.findByRole('heading', { name: 'More in this category' })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('shows Page 1 of 2 for 16 products, where 13 follow the top three', async () => {
    mocked.mockResolvedValue(at(1, 13, three, many(12)))
    renderAt('/categories/electronics')
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('encodes a category name with an apostrophe and a space in both links', async () => {
    mocked.mockResolvedValue(at(2, 40, [], many(12)))
    renderAt("/categories/men's%20clothing?page=2")
    await screen.findByText('Page 2 of 4')
    expect(mocked).toHaveBeenCalledWith("men's clothing", 2)
    expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', "/categories/men's%20clothing")
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', "/categories/men's%20clothing?page=3")
  })

  it('skips the disabled Previous button in the tab order on page 1', async () => {
    mocked.mockResolvedValue(at(1, 100, three, many(12)))
    renderAt('/categories/electronics')
    await screen.findByText('Page 1 of 9')
    const stops = await tabStops()
    expect(stops).toContain(screen.getByRole('link', { name: 'Next page' }))
    expect(stops).not.toContain(screen.getByRole('button', { name: 'Previous page' }))
  })

  it('skips the disabled Next button in the tab order on the last page', async () => {
    mocked.mockResolvedValue(at(9, 100, [], many(4)))
    renderAt('/categories/electronics?page=9')
    await screen.findByText('Page 9 of 9')
    const stops = await tabStops()
    expect(stops).toContain(screen.getByRole('link', { name: 'Previous page' }))
    expect(stops).not.toContain(screen.getByRole('button', { name: 'Next page' }))
  })

  it('does not focus the heading or scroll on a first load of page 2', async () => {
    mocked.mockResolvedValue(at(2, 40, [], many(12)))
    renderAt('/categories/electronics?page=2')
    await screen.findByText('Page 2 of 4')
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls to the top exactly once after Next is clicked', async () => {
    mocked.mockResolvedValue(at(1, 40, three, many(12)))
    renderAt('/categories/electronics')
    await screen.findByText('Page 1 of 4')
    mocked.mockResolvedValue(at(2, 40, [], many(12)))
    await userEvent.click(screen.getByRole('link', { name: 'Next page' }))
    await screen.findByText('Page 2 of 4')
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('keeps focus, clears the paged flag and does not scroll or refetch again after Next', async () => {
    mocked.mockResolvedValue(at(1, 40, three, many(12)))
    const router = renderAt('/categories/electronics')
    await screen.findByText('Page 1 of 4')
    mocked.mockResolvedValue(at(2, 40, [], many(12)))
    await userEvent.click(screen.getByRole('link', { name: 'Next page' }))
    await screen.findByText('Page 2 of 4')
    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(router.state.location.search).toBe('?page=2')
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledTimes(2)
  })

  it('shows the error notice when the server rejects the page with a 400', async () => {
    mocked.mockRejectedValue(new ApiError(400, 'validation_failed', 'Check.', { page: 'Use a whole number from 1.' }))
    renderAt('/categories/electronics?page=2')
    expect(await screen.findByRole('alert')).toHaveTextContent('Products did not load')
  })
})
