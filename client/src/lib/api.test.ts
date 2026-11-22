// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EnquiryError } from './enquiry'
import { ApiError, getCategoryPage, getFeatured, getProduct, searchProducts, sendEnquiry } from './api'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const stubFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('returns parsed JSON from /api on success', async () => {
    const fn = stubFetch(async () => json([{ id: 1, title: 'A' }]))
    await expect(getFeatured()).resolves.toEqual([{ id: 1, title: 'A' }])
    expect(fn.mock.calls[0][0]).toBe('/api/products/featured')
  })

  it('throws ApiError with status, code, message and fields from the error shape', async () => {
    stubFetch(async () =>
      json({ error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields: { email: 'Enter a valid email address.' } } }, 400),
    )
    const error = await getProduct('1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      code: 'validation_failed',
      message: 'Check the highlighted fields.',
      fields: { email: 'Enter a valid email address.' },
    })
  })

  it('throws a generic ApiError when the error body is not JSON', async () => {
    stubFetch(async () => new Response('<html>bad gateway</html>', { status: 502 }))
    await expect(getFeatured()).rejects.toMatchObject({ status: 502, code: 'unknown_error' })
  })

  it('throws a bad_response ApiError when a successful reply is not JSON', async () => {
    stubFetch(async () => new Response('<html>ok</html>', { status: 200 }))
    const error = await getFeatured().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 200, code: 'bad_response' })
  })

  it('throws ApiError with status 0 when the network fails', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(getFeatured()).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('encodes the search term', async () => {
    const fn = stubFetch(async () => json({ products: [], page: 1, pageSize: 12, total: 0 }))
    await searchProducts('men & women/shirt')
    expect(fn.mock.calls[0][0]).toBe('/api/products?q=men+%26+women%2Fshirt')
  })

  it('sends the page only after page 1', async () => {
    const fn = stubFetch(async () => json({ products: [], page: 1, pageSize: 12, total: 0 }))
    await searchProducts('shirt', 1)
    await searchProducts('shirt', 3)
    await getCategoryPage('toys', 1)
    await getCategoryPage('toys', 2)
    expect(fn.mock.calls.map((c) => c[0])).toEqual([
      '/api/products?q=shirt',
      '/api/products?q=shirt&page=3',
      '/api/categories/toys/products',
      '/api/categories/toys/products?page=2',
    ])
  })

  it('encodes the category path segment', async () => {
    const fn = stubFetch(async () => json({ topRated: [], products: [], page: 1, pageSize: 20, total: 0 }))
    await getCategoryPage("men's clothing")
    expect(fn.mock.calls[0][0]).toBe("/api/categories/men's%20clothing/products")
  })

  it('encodes the product id path segment', async () => {
    const fn = stubFetch(async () => json({ id: 'a/b?c', title: 'T' }))
    await getProduct('a/b?c')
    expect(fn.mock.calls[0][0]).toBe('/api/products/a%2Fb%3Fc')
  })

  it('posts the enquiry as JSON', async () => {
    const fn = stubFetch(async () => json({ status: 'sent' }, 201))
    const payload = { name: 'Ann', email: 'a@b.co', message: 'Hi' }
    await expect(sendEnquiry(payload)).resolves.toBeUndefined()
    const init = fn.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify(payload))
  })

  it('sends name, email, phone, message, product and website in the body', async () => {
    const fn = stubFetch(async () => json({ status: 'sent' }, 201))
    const payload = {
      name: 'Ann',
      email: 'a@b.co',
      phone: '+44 1',
      message: 'Hi',
      product: { id: '7', title: 'T', price: 9 },
      website: 'x',
    }
    await sendEnquiry(payload)
    expect(JSON.parse((fn.mock.calls[0][1] as RequestInit).body as string)).toEqual(payload)
  })

  it('rejects with EnquiryError carrying fields for a 400 with fields', async () => {
    stubFetch(async () => json({ error: { code: 'validation_failed', message: 'Check.', fields: { phone: 'Use digits.' } } }, 400))
    const error = await sendEnquiry({ name: 'a', email: 'x', message: 'm' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EnquiryError)
    expect(error).toMatchObject({ fields: { phone: 'Use digits.' } })
  })

  it('rejects with a not-found message for a 404', async () => {
    stubFetch(async () => json({ error: { code: 'not_found', message: 'Nope.' } }, 404))
    const error = await sendEnquiry({ name: 'a', email: 'x', message: 'm' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EnquiryError)
    expect(error).toMatchObject({ message: 'We could not find that product. Go back to the catalogue and try again.' })
  })

  it('rejects with a plain ApiError for a 400 with only unknown field keys', async () => {
    stubFetch(async () => json({ error: { code: 'validation_failed', message: 'Check.', fields: { colour: 'Bad.' } } }, 400))
    const error = await sendEnquiry({ name: 'a', email: 'x', message: 'm' }).catch((e: unknown) => e)
    expect(error).not.toBeInstanceOf(EnquiryError)
    expect(error).toMatchObject({ status: 400 })
  })

  it('uses the product field text as the message for a product-only 400', async () => {
    stubFetch(async () => json({ error: { code: 'validation_failed', message: 'Check.', fields: { product: 'That product is not valid.' } } }, 400))
    const error = await sendEnquiry({ name: 'a', email: 'x', message: 'm' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ message: 'That product is not valid.', fields: { product: 'That product is not valid.' } })
  })

  it('rejects with EnquiryError carrying the server message for a 429', async () => {
    stubFetch(async () => json({ error: { code: 'rate_limited', message: 'Try again in a few minutes.' } }, 429))
    const error = await sendEnquiry({ name: 'a', email: 'x', message: 'm' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EnquiryError)
    expect(error).toMatchObject({ message: 'Try again in a few minutes.' })
  })

  it('rejects with EnquiryError carrying the server message for enquiry_not_sent', async () => {
    stubFetch(async () => json({ error: { code: 'enquiry_not_sent', message: 'We could not send your enquiry.' } }, 502))
    await expect(sendEnquiry({ name: 'a', email: 'x', message: 'm' })).rejects.toBeInstanceOf(EnquiryError)
  })

  it('rejects with a plain ApiError when the network fails', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await sendEnquiry({ name: 'a', email: 'x', message: 'm' }).catch((e: unknown) => e)
    expect(error).not.toBeInstanceOf(EnquiryError)
    expect(error).toMatchObject({ status: 0, code: 'network_error' })
  })
})
