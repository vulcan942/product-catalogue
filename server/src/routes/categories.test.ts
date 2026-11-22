import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.ts'
import { NotFoundError, UpstreamError } from '../domain/errors.ts'
import type { Product } from '../domain/product.ts'
import { createCatalogueService, type CatalogueService } from '../services/catalogue.ts'
import { fakeProductProvider, noopEnquiry, testConfig } from '../../test/helpers.ts'

const servers: Array<{ close: () => void }> = []
afterEach(() => {
  servers.splice(0).forEach((s) => s.close())
  vi.restoreAllMocks()
})

function start(catalogue: CatalogueService) {
  const server = createApp(testConfig, { catalogue, enquiry: noopEnquiry }).listen(0)
  servers.push(server)
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const reject = async (): Promise<never> => {
  throw new Error('not used')
}
const stub = (o: Partial<CatalogueService>): CatalogueService => ({
  getFeatured: reject,
  listCategories: reject,
  getCategoryPage: reject,
  search: reject,
  getProduct: reject,
  ...o,
})
const failWith = (err: Error) => async (): Promise<never> => {
  throw err
}

const full: Product = { id: '1', title: 'Shirt', price: 9.5, image: 'i.png', category: 'men', description: 'long', rating: 4.5 }
const card = { id: '1', title: 'Shirt', price: 9.5, image: 'i.png', category: 'men' }

describe('GET /api/categories', () => {
  it('returns the category names', async () => {
    const res = await fetch(`${start(stub({ listCategories: async () => ['men', 'jewelery'] }))}/api/categories`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(['men', 'jewelery'])
  })

  it('returns 502 when upstream fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await fetch(`${start(stub({ listCategories: failWith(new UpstreamError('boom')) }))}/api/categories`)
    expect(res.status).toBe(502)
  })
})

describe('GET /api/categories/:category/products', () => {
  it('returns cards without rating or description, plus paging fields', async () => {
    const getCategoryPage: CatalogueService['getCategoryPage'] = async (_c, paging) => ({
      topRated: [full],
      products: [{ ...full, id: '2' }, { ...full, id: '3' }],
      total: 2,
      ...paging,
    })
    const res = await fetch(`${start(stub({ getCategoryPage }))}/api/categories/men/products`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      topRated: [card],
      products: [{ ...card, id: '2' }, { ...card, id: '3' }],
      page: 1,
      pageSize: 12,
      total: 2,
    })
  })

  it('passes the decoded category and default paging to the service', async () => {
    const getCategoryPage = vi.fn<CatalogueService['getCategoryPage']>(async (_c, paging) => ({ topRated: [], products: [], total: 0, ...paging }))
    await fetch(`${start(stub({ getCategoryPage }))}/api/categories/women%20clothing/products`)
    expect(getCategoryPage).toHaveBeenCalledWith('women clothing', { page: 1, pageSize: 12 })
  })

  it('passes a custom page and pageSize to the service and echoes them', async () => {
    const getCategoryPage = vi.fn<CatalogueService['getCategoryPage']>(async (_c, paging) => ({ topRated: [], products: [full], total: 40, ...paging }))
    const body = await (await fetch(`${start(stub({ getCategoryPage }))}/api/categories/men/products?page=5&pageSize=7`)).json()
    expect(getCategoryPage).toHaveBeenCalledWith('men', { page: 5, pageSize: 7 })
    expect(body).toMatchObject({ page: 5, pageSize: 7, total: 40 })
  })

  const pageError = { page: 'Use a whole number from 1 to 1000000.' }
  const sizeError = { pageSize: 'Use a whole number from 1 to 50.' }
  const invalid = (fields: object) => ({
    error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields },
  })

  it.each(['0', '-1', 'abc', '1.5', '1e1', '0x10', '%201', '1%20', '', '1.0', '1000001', '99999999999999999999999'])(
    'returns 400 for page=%s',
    async (value) => {
      const res = await fetch(`${start(stub({}))}/api/categories/men/products?page=${value}`)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual(invalid(pageError))
    },
  )

  it.each(['0', '51', '-1', 'abc', '1e1', ''])('returns 400 for pageSize=%s', async (value) => {
    const res = await fetch(`${start(stub({}))}/api/categories/men/products?pageSize=${value}`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(invalid(sizeError))
  })

  it('validates paging before looking up the category', async () => {
    const getCategoryPage = vi.fn(failWith(new NotFoundError('Unknown category nope')))
    const res = await fetch(`${start(stub({ getCategoryPage }))}/api/categories/nope/products?page=0`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(invalid(pageError))
    expect(getCategoryPage).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown category when paging is valid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await fetch(`${start(stub({ getCategoryPage: failWith(new NotFoundError('Unknown category nope')) }))}/api/categories/nope/products`)
    expect(res.status).toBe(404)
  })

  it('returns 400 for a repeated page param', async () => {
    const res = await fetch(`${start(stub({}))}/api/categories/men/products?page=1&page=2`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(invalid(pageError))
  })

  it('reports page and pageSize errors together', async () => {
    const res = await fetch(`${start(stub({}))}/api/categories/men/products?page=0&pageSize=99`)
    expect(await res.json()).toEqual(invalid({ ...pageError, ...sizeError }))
  })

  it('accepts pageSize 1 and 50', async () => {
    const getCategoryPage = vi.fn<CatalogueService['getCategoryPage']>(async (_c, paging) => ({ topRated: [], products: [], total: 0, ...paging }))
    const base = start(stub({ getCategoryPage }))
    expect((await fetch(`${base}/api/categories/men/products?pageSize=1`)).status).toBe(200)
    expect((await fetch(`${base}/api/categories/men/products?pageSize=50`)).status).toBe(200)
  })

  it('returns 404 with the shared error shape for an unknown category', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const base = start(stub({ getCategoryPage: failWith(new NotFoundError('Unknown category x')) }))
    const res = await fetch(`${base}/api/categories/x/products`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'We could not find that.' } })
  })

  it('returns 400 bad_request for a malformed percent-encoded path', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await fetch(`${start(stub({}))}/api/categories/%E0%A4%A/products`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: { code: 'bad_request', message: 'The request could not be read.' } })
  })

  it('returns 400 with fields for a blank category', async () => {
    const res = await fetch(`${start(stub({}))}/api/categories/%20/products`)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string; fields: object } }
    expect(body.error.code).toBe('validation_failed')
    expect(Object.keys(body.error.fields)).toEqual(['category'])
  })

  it('returns 400 for a category over 64 characters', async () => {
    const res = await fetch(`${start(stub({}))}/api/categories/${'a'.repeat(65)}/products`)
    expect(res.status).toBe(400)
  })

  it('returns 502 when upstream fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const base = start(stub({ getCategoryPage: failWith(new UpstreamError('boom')) }))
    const res = await fetch(`${base}/api/categories/men/products`)
    expect(res.status).toBe(502)
  })
})

describe('category endpoints with the real service and a fake provider', () => {
  const products = [1, 2, 3, 4, 5].map((n): Product => ({ ...full, id: String(n), rating: n }))
  const real = () => start(createCatalogueService({ provider: fakeProductProvider(products), featuredIds: [] }))

  it('returns the top three by rating then the rest', async () => {
    const body = (await (await fetch(`${real()}/api/categories/men/products`)).json()) as { topRated: Product[]; products: Product[] }
    expect(body.topRated.map((p) => p.id)).toEqual(['5', '4', '3'])
    expect(body.products.map((p) => p.id)).toEqual(['2', '1'])
  })

  type Body = { topRated: Product[]; products: Product[] }
  const fetchIds = async (list: Product[]) => {
    const base = start(createCatalogueService({ provider: fakeProductProvider(list), featuredIds: [] }))
    const body = (await (await fetch(`${base}/api/categories/men/products`)).json()) as Body
    return { top: body.topRated.map((p) => p.id), rest: body.products.map((p) => p.id), body }
  }
  const withRatings = (ratings: Array<number | undefined>) =>
    ratings.map((rating, n): Product => ({ ...full, id: String(n + 1), rating }))

  it('orders equal ratings by id across the top three and the rest', async () => {
    const { top, rest } = await fetchIds(withRatings([4, 4, 4, 4, 4]).reverse())
    expect(top).toEqual(['1', '2', '3'])
    expect(rest).toEqual(['4', '5'])
  })

  it('puts a product with no rating after every rated one', async () => {
    const { top, rest } = await fetchIds(withRatings([undefined, 1, 2, 3]))
    expect(top).toEqual(['4', '3', '2'])
    expect(rest).toEqual(['1'])
  })

  it('returns exactly three top rated and none more when the category has three products', async () => {
    const { top, rest } = await fetchIds(withRatings([1, 2, 3]))
    expect(top).toHaveLength(3)
    expect(rest).toEqual([])
  })

  it('returns three top rated and one more when the category has four products', async () => {
    const { top, rest, body } = await fetchIds(withRatings([1, 2, 3, 4]))
    expect(top).toEqual(['4', '3', '2'])
    expect(rest).toEqual(['1'])
    expect(body.products).toHaveLength(1)
  })

  it('returns 404 for an unknown category', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await fetch(`${real()}/api/categories/toys/products`)).status).toBe(404)
  })

  it('returns 404 for an unknown category on page 2', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await fetch(`${real()}/api/categories/toys/products?page=2`)).status).toBe(404)
  })

  it('returns page 2 with no top rated and the next products', async () => {
    const body = (await (await fetch(`${real()}/api/categories/men/products?page=2&pageSize=1`)).json()) as Body
    expect(body).toMatchObject({ topRated: [], page: 2, pageSize: 1, total: 2 })
    expect(body.products.map((p) => p.id)).toEqual(['1'])
  })

  it('accepts the maximum page of 1000000 and returns empty products', async () => {
    const res = await fetch(`${real()}/api/categories/men/products?page=1000000`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ products: [], page: 1000000, total: 2 })
  })

  it('returns 200 with empty products and the real total past the end', async () => {
    const res = await fetch(`${real()}/api/categories/men/products?page=9`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ topRated: [], products: [], page: 9, pageSize: 12, total: 2 })
  })
})
