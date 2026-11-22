import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  getCategories,
  getCategoryPage,
  getFeatured,
  getProduct,
  searchProducts,
  sendEnquiry,
  type ProductDetail,
} from '@/lib/api'
import { routes } from '@/routes'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getCategories: vi.fn().mockResolvedValue([]),
  getCategoryPage: vi.fn(),
  getFeatured: vi.fn(),
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
  sendEnquiry: vi.fn(),
}))

const mocked = vi.mocked(getProduct)
const send = vi.mocked(sendEnquiry)

const product: ProductDetail = {
  id: '7',
  title: 'Solid Drive',
  price: 109,
  image: 'https://img.test/drive.png',
  category: "men's clothing",
  description: 'Fast and quiet.',
}

const renderAt = (path = '/products/7') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCategories).mockResolvedValue([])
})

describe('ProductPage', () => {
  it('shows the product image, title, price, category link, description and Enquire', async () => {
    mocked.mockResolvedValue(product)
    renderAt()
    expect(await screen.findByRole('heading', { level: 1, name: 'Solid Drive' })).toBeInTheDocument()
    expect(mocked).toHaveBeenCalledWith('7')
    expect(screen.getByRole('img', { name: 'Solid Drive' })).toHaveAttribute('src', product.image)
    expect(screen.getByText('$109.00')).toBeInTheDocument()
    expect(screen.getByText('Fast and quiet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "men's clothing" })).toHaveAttribute(
      'href',
      "/categories/men's%20clothing",
    )
    expect(screen.getByRole('link', { name: 'Back to products' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: 'Enquire' })).toBeInTheDocument()
  })

  it('hides price, description and category and shows No image when they are missing', async () => {
    mocked.mockResolvedValue({ id: '7', title: 'Bare item' })
    renderAt()
    await screen.findByRole('heading', { level: 1, name: 'Bare item' })
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /categor/i })).not.toBeInTheDocument()
    expect(screen.getByText('No image')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows No image when the image fails to load', async () => {
    mocked.mockResolvedValue(product)
    renderAt()
    const img = await screen.findByRole('img', { name: 'Solid Drive' })
    img.dispatchEvent(new Event('error'))
    expect(await screen.findByText('No image')).toBeInTheDocument()
  })

  it('opens the enquiry dialog and returns focus to Enquire when Cancel is pressed', async () => {
    mocked.mockResolvedValue(product)
    renderAt()
    const enquire = await screen.findByRole('button', { name: 'Enquire' })
    await userEvent.click(enquire)
    expect(await screen.findByRole('dialog', { name: 'Enquire about Solid Drive' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(enquire).toHaveFocus()
  })

  it('sends the entered values with the product and then shows Enquiry sent', async () => {
    mocked.mockResolvedValue(product)
    send.mockResolvedValue(undefined)
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Enquire' }))
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada')
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }))
    expect(await screen.findByText('Enquiry sent')).toBeInTheDocument()
    expect(send).toHaveBeenCalledWith({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'I am interested in Solid Drive.',
      product: { id: '7', title: 'Solid Drive', price: 109 },
    })
  })

  it('goes to the home page when Back to products is pressed after a sent enquiry', async () => {
    mocked.mockResolvedValue(product)
    send.mockResolvedValue(undefined)
    vi.mocked(getFeatured).mockResolvedValue([])
    const router = renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Enquire' }))
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada')
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Back to products' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows the form failure message when sending is rejected', async () => {
    mocked.mockResolvedValue(product)
    send.mockRejectedValue(new ApiError(500, 'server_error', 'boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Enquire' }))
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada')
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }))
    expect(await screen.findByText('Enquiry not sent')).toBeInTheDocument()
    expect(screen.queryByText('Enquiry sent')).not.toBeInTheDocument()
  })

  it.each([
    ['404', new ApiError(404, 'not_found', 'nope')],
    ['400 on the id', new ApiError(400, 'validation_failed', 'bad', { id: 'Invalid id' })],
  ])('shows the not-found heading for a %s', async (_name, error) => {
    mocked.mockRejectedValue(error)
    renderAt()
    expect(await screen.findByRole('heading', { level: 1, name: 'We could not find that product.' })).toBeInTheDocument()
  })

  it.each([
    ['404', new ApiError(404, 'not_found', 'nope')],
    ['400 on the id', new ApiError(400, 'validation_failed', 'bad', { id: 'Invalid id' })],
  ])('links back to the catalogue from the not-found state for a %s', async (_name, error) => {
    mocked.mockRejectedValue(error)
    renderAt()
    expect(await screen.findByRole('link', { name: 'Go to the catalogue' })).toHaveAttribute('href', '/')
  })

  it('sets the document title to Product not found for an unknown product', async () => {
    mocked.mockRejectedValue(new ApiError(404, 'not_found', 'nope'))
    renderAt()
    await waitFor(() => expect(document.title).toBe('Product not found - Catalogue'))
  })

  it('shows an alert for other failures and fetches again on Try again', async () => {
    mocked.mockRejectedValueOnce(new ApiError(500, 'server_error', 'boom'))
    mocked.mockResolvedValueOnce(product)
    renderAt()
    expect(await screen.findByRole('alert')).toHaveTextContent('Product did not load')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Solid Drive' })).toBeInTheDocument()
    expect(mocked).toHaveBeenCalledTimes(2)
  })

  it('shows a busy loading placeholder while the product loads', () => {
    mocked.mockReturnValue(new Promise(() => {}))
    renderAt()
    const status = screen.getByRole('status', { name: 'Loading product' })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('sets the document title to the product and resets it on leaving', async () => {
    mocked.mockResolvedValue(product)
    const router = createMemoryRouter(routes, { initialEntries: ['/products/7'] })
    const { unmount } = render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(document.title).toBe('Solid Drive - Catalogue'))
    unmount()
    expect(document.title).toBe('Catalogue')
  })

  it('opens the product page from a home card link', async () => {
    vi.mocked(getFeatured).mockResolvedValue([{ id: '7', title: 'Solid Drive', price: 109, image: '', category: 'x' }])
    mocked.mockResolvedValue(product)
    const router = renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Solid Drive' }))
    expect(router.state.location.pathname).toBe('/products/7')
    expect(await screen.findByRole('heading', { level: 1, name: 'Solid Drive' })).toBeInTheDocument()
  })

  it('opens the product page from a category page card link', async () => {
    const card = { id: '7', title: 'Solid Drive', price: 109, image: '', category: 'x' }
    vi.mocked(getCategoryPage).mockResolvedValue({ topRated: [card], products: [], page: 1, pageSize: 20, total: 1 })
    mocked.mockResolvedValue(product)
    const router = renderAt('/categories/x')
    await userEvent.click(await screen.findByRole('link', { name: 'Solid Drive' }))
    expect(router.state.location.pathname).toBe('/products/7')
    expect(await screen.findByRole('heading', { level: 1, name: 'Solid Drive' })).toBeInTheDocument()
    expect(screen.getByText('Fast and quiet.')).toBeInTheDocument()
  })

  it('opens the product page from a search result card link', async () => {
    const card = { id: '7', title: 'Solid Drive', price: 109, image: '', category: 'x' }
    vi.mocked(searchProducts).mockResolvedValue({ products: [card], page: 1, pageSize: 1, total: 1 })
    mocked.mockResolvedValue(product)
    const router = renderAt('/search?q=drive')
    await userEvent.click(await screen.findByRole('link', { name: 'Solid Drive' }))
    expect(router.state.location.pathname).toBe('/products/7')
    expect(await screen.findByRole('heading', { level: 1, name: 'Solid Drive' })).toBeInTheDocument()
    expect(screen.getByText('Fast and quiet.')).toBeInTheDocument()
  })

  it('hides only the price line when the price is missing', async () => {
    mocked.mockResolvedValue({ ...product, price: undefined })
    renderAt()
    await screen.findByRole('heading', { level: 1, name: 'Solid Drive' })
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.getByText('Fast and quiet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enquire' })).toBeInTheDocument()
  })

  it('closes the enquiry dialog on Escape and returns focus to Enquire', async () => {
    mocked.mockResolvedValue(product)
    renderAt()
    const enquire = await screen.findByRole('button', { name: 'Enquire' })
    await userEvent.click(enquire)
    await screen.findByRole('dialog', { name: 'Enquire about Solid Drive' })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(enquire).toHaveFocus()
  })
})
