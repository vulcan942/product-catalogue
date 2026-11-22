import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.ts'
import { UpstreamError } from '../domain/errors.ts'
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
const stub = (overrides: Partial<CatalogueService>): CatalogueService => ({
  getFeatured: reject,
  listCategories: reject,
  getCategoryPage: reject,
  search: reject,
  getProduct: reject,
  ...overrides,
})
const failing = (err: Error): CatalogueService =>
  stub({
    getFeatured: async () => {
      throw err
    },
  })

describe('GET /api/products/featured', () => {
  it('returns wire products without description or rating', async () => {
    const full = { id: '1', title: 'Shirt', price: 9.5, image: 'i.png', category: 'men', description: 'long', rating: 4.5 }
    const res = await fetch(`${start(stub({ getFeatured: async () => [full] }))}/api/products/featured`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: '1', title: 'Shirt', price: 9.5, image: 'i.png', category: 'men' }])
  })

  it('returns 502 with the shared error shape when upstream fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await fetch(`${start(failing(new UpstreamError('boom')))}/api/products/featured`)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: { code: 'upstream_unavailable', message: 'Products are unavailable right now. Try again in a moment.' },
    })
  })

  it('does not leak upstream details in a 502', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new UpstreamError('fakestoreapi.com returned 503', { cause: new Error('ECONNRESET') })
    const res = await fetch(`${start(failing(err))}/api/products/featured`)
    expect(await res.text()).not.toMatch(/fakestore|503|ECONNRESET/)
  })

  it('returns a generic 500 without leaking an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await fetch(`${start(failing(new Error('secret db password')))}/api/products/featured`)
    const text = await res.text()
    expect(res.status).toBe(500)
    expect(JSON.parse(text).error.code).toBe('internal_error')
    expect(text).not.toMatch(/secret|stack/)
  })
})

describe('GET /api/products (search)', () => {
  const full = { id: '1', title: 'Red Shirt', price: 9.5, image: 'i.png', category: 'men', description: 'long', rating: 4.5 }
  const withProducts = () =>
    start(createCatalogueService({ provider: fakeProductProvider([full, { ...full, id: '2', title: 'Hat' }]), featuredIds: [] }))
  const validation = (q: string) => ({
    error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields: { q } },
  })

  it('returns wire products without description or rating and paging totals', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=shirt`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      products: [{ id: '1', title: 'Red Shirt', price: 9.5, image: 'i.png', category: 'men' }],
      page: 1,
      pageSize: 12,
      total: 1,
    })
  })

  it('returns 200 with an empty list when nothing matches', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=zzz`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ products: [], page: 1, pageSize: 12, total: 0 })
  })

  it('pages the matches and echoes page, pageSize and the match count', async () => {
    const body = await (await fetch(`${withProducts()}/api/products?q=h&page=2&pageSize=1`)).json()
    expect(body).toEqual({ products: [{ id: '2', title: 'Hat', price: 9.5, image: 'i.png', category: 'men' }], page: 2, pageSize: 1, total: 2 })
  })

  it('returns 200 with empty products and the real total past the end', async () => {
    const body = await (await fetch(`${withProducts()}/api/products?q=shirt&page=5`)).json()
    expect(body).toEqual({ products: [], page: 5, pageSize: 12, total: 1 })
  })

  it('accepts the maximum page of 1000000 and returns empty products', async () => {
    const body = await (await fetch(`${withProducts()}/api/products?q=shirt&page=1000000`)).json()
    expect(body).toEqual({ products: [], page: 1000000, pageSize: 12, total: 1 })
  })

  it('passes a custom page and pageSize to the service', async () => {
    const search = vi.fn<CatalogueService['search']>(async (_t, paging) => ({ products: [], total: 0, ...paging }))
    await fetch(`${start(stub({ search }))}/api/products?q=hat&page=3&pageSize=7`)
    expect(search).toHaveBeenCalledWith('hat', { page: 3, pageSize: 7 })
  })

  const pageError = 'Use a whole number from 1 to 1000000.'
  const sizeError = 'Use a whole number from 1 to 50.'

  it.each(['0', '-1', 'abc', '1.5', '1e1', '0x10', '%201', '1000001', ''])('returns 400 for page=%s', async (value) => {
    const res = await fetch(`${withProducts()}/api/products?q=hat&page=${value}`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields: { page: pageError } },
    })
  })

  it.each(['0', '51', 'abc', '1e1', ''])('returns 400 for pageSize=%s', async (value) => {
    const res = await fetch(`${withProducts()}/api/products?q=hat&pageSize=${value}`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields: { pageSize: sizeError } },
    })
  })

  it('returns 400 for a repeated page param', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=hat&page=1&page=2`)
    expect(res.status).toBe(400)
  })

  it('merges q and page errors into one fields object', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=&page=0&pageSize=99`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: {
        code: 'validation_failed',
        message: 'Check the highlighted fields.',
        fields: { q: 'Enter a word to search for.', page: pageError, pageSize: sizeError },
      },
    })
  })

  it('returns 400 with fields.q when q is missing', async () => {
    const res = await fetch(`${withProducts()}/api/products`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(validation('Enter a word to search for.'))
  })

  it('returns 400 when q is empty', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(validation('Enter a word to search for.'))
  })

  it('returns 400 when q is only whitespace', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=%20%20%20`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(validation('Enter a word to search for.'))
  })

  it('returns 400 when q is longer than 100 characters', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=${'a'.repeat(101)}`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(validation('Use 100 characters or fewer.'))
  })

  it('accepts q of exactly 100 characters', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=${'a'.repeat(100)}`)
    expect(res.status).toBe(200)
  })

  it('trims and collapses spaces in q before searching', async () => {
    const search = vi.fn<CatalogueService['search']>(async (_t, paging) => ({ products: [], total: 0, ...paging }))
    await fetch(`${start(stub({ search }))}/api/products?q=%20%20red%20%20%20shirt%20`)
    expect(search).toHaveBeenCalledWith('red shirt', { page: 1, pageSize: 12 })
  })

  describe('with a fake provider', () => {
    const base = { price: 1, image: 'i.png', category: 'men' }
    const catalogue = () =>
      start(
        createCatalogueService({
          provider: fakeProductProvider([
            { ...base, id: '1', title: 'Red shirt', description: 'Soft cotton' },
            { ...base, id: '2', title: 'Plain hat', description: 'Made of red wool' },
            { ...base, id: '3', title: 'Bare scarf' },
          ]),
          featuredIds: [],
        }),
      )
    const idsFor = async (q: string) => {
      const body = (await (await fetch(`${catalogue()}/api/products?q=${q}`)).json()) as { products: { id: string }[] }
      return body.products.map((x) => x.id)
    }

    it('returns products matching in title or description and excludes the rest', async () => {
      expect(await idsFor('red')).toEqual(['1', '2'])
    })

    it('returns the same results for spaced-out and single-spaced terms', async () => {
      expect(await idsFor('%20red%20%20%20shirt')).toEqual(await idsFor('red%20shirt'))
    })

    it('does not fail on products without a description', async () => {
      expect(await idsFor('bare')).toEqual(['3'])
    })
  })

  it('returns 400 instead of 500 when q is repeated', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=a&q=b`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(validation('Enter a word to search for.'))
  })

  it('returns 502 when upstream fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const search = async (): Promise<never> => {
      throw new UpstreamError('boom')
    }
    const res = await fetch(`${start(stub({ search }))}/api/products?q=a`)
    expect(res.status).toBe(502)
  })
})

// fetch() normalises dot segments before sending, so raw paths go through node:http.
function rawGet(base: string, path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const { hostname, port } = new URL(base)
    http
      .get({ hostname, port, path }, (res) => {
        let text = ''
        res.on('data', (c) => (text += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : null }))
      })
      .on('error', reject)
  })
}

describe('GET /api/products/:id', () => {
  const full = { id: '1', title: 'Shirt', price: 9.5, image: 'i.png', category: 'men', description: 'long', rating: 4.5 }
  const withProducts = (provider = fakeProductProvider([full, { id: '2', title: 'Hat' }])) =>
    start(createCatalogueService({ provider, featuredIds: ['1'] }))
  const invalid = {
    error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields: { id: 'That product link is not valid.' } },
  }

  it('returns the detail with description and without rating', async () => {
    const res = await fetch(`${withProducts()}/api/products/1`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: '1', title: 'Shirt', price: 9.5, image: 'i.png', category: 'men', description: 'long' })
  })

  it('omits description when the product has none', async () => {
    const res = await fetch(`${withProducts()}/api/products/2`)
    expect(await res.json()).toEqual({ id: '2', title: 'Hat' })
  })

  it('returns 404 with the shared shape for an unknown id', async () => {
    const res = await fetch(`${withProducts()}/api/products/999`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'We could not find that.' } })
  })

  it.each(['a%20b', '%207%20', 'a.b', 'a'.repeat(65)])('returns 400 for id %s', async (id) => {
    const res = await fetch(`${withProducts()}/api/products/${id}`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(invalid)
  })

  it.each(['..', '.', '%2e%2e', '%2e', 'a%2Fb'])('returns 400 and never calls the provider for raw id %s', async (id) => {
    const provider = fakeProductProvider([full])
    const getById = vi.spyOn(provider, 'getById')
    const res = await rawGet(withProducts(provider), `/api/products/${id}`)
    expect(res.status).toBe(400)
    expect(res.body).toEqual(invalid)
    expect(getById).not.toHaveBeenCalled()
  })

  it('does not route an empty id to the provider', async () => {
    const provider = fakeProductProvider([full])
    const getById = vi.spyOn(provider, 'getById')
    const res = await fetch(`${withProducts(provider)}/api/products/`)
    expect(res.status).not.toBe(200)
    expect(getById).not.toHaveBeenCalled()
  })

  it('returns 502 when upstream fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await fetch(`${withProducts(fakeProductProvider([], new UpstreamError('boom')))}/api/products/1`)
    expect(res.status).toBe(502)
  })

  it('does not shadow /products/featured', async () => {
    const res = await fetch(`${withProducts()}/api/products/featured`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: '1', title: 'Shirt', price: 9.5, image: 'i.png', category: 'men' }])
  })

  it('still serves /products?q search', async () => {
    const res = await fetch(`${withProducts()}/api/products?q=hat`)
    expect(((await res.json()) as { products: unknown[] }).products).toEqual([{ id: '2', title: 'Hat' }])
  })
})

describe('unknown API paths', () => {
  it('returns 404 with the shared JSON error shape', async () => {
    const res = await fetch(`${start(stub({ getFeatured: async () => [] }))}/api/unknown`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'We could not find that page.' } })
  })
})
