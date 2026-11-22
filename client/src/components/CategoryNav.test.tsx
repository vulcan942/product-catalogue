import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CategoryNav } from '@/components/CategoryNav'
import { ApiError, getCategories } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getCategories: vi.fn(),
}))

const mocked = vi.mocked(getCategories)

const renderNav = (path = '/', heading?: string) => {
  const router = createMemoryRouter([{ path: '*', element: <CategoryNav heading={heading} /> }], {
    initialEntries: [path],
  })
  return render(<RouterProvider router={router} />)
}

describe('CategoryNav', () => {
  it('links each category to its page', async () => {
    mocked.mockResolvedValue(['electronics', "men's clothing"])
    renderNav()
    expect(await screen.findByRole('link', { name: 'electronics' })).toHaveAttribute('href', '/categories/electronics')
    expect(screen.getByRole('link', { name: "men's clothing" })).toHaveAttribute(
      'href',
      "/categories/men's%20clothing",
    )
    expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument()
    expect(screen.getByText("men's clothing")).toHaveClass('first-letter:uppercase')
  })

  it('marks the current category as the current page', async () => {
    mocked.mockResolvedValue(['electronics', 'jewelery'])
    renderNav('/categories/jewelery')
    expect(await screen.findByRole('link', { name: 'jewelery' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'electronics' })).not.toHaveAttribute('aria-current')
  })

  it('names the nav by its heading when one is given', async () => {
    mocked.mockResolvedValue(['electronics'])
    renderNav('/', 'Browse categories')
    expect(await screen.findByRole('navigation', { name: 'Browse categories' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Browse categories' })).toBeInTheDocument()
  })

  it('shows a labelled placeholder while categories load', () => {
    mocked.mockReturnValue(new Promise(() => {}))
    renderNav()
    expect(screen.getByLabelText('Loading categories')).toHaveAttribute('aria-busy', 'true')
  })

  it('renders nothing, not even the heading, when there are no categories', async () => {
    mocked.mockResolvedValue([])
    const { container } = renderNav('/', 'Browse categories')
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows the error notice when categories fail to load', async () => {
    mocked.mockRejectedValue(new ApiError(0, 'network_error', 'down'))
    renderNav()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Categories did not load')
    expect(alert).toHaveTextContent('Refresh the page to try again.')
  })
})
