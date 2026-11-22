import { describe, expect, it } from 'vitest'
import { UpstreamError } from '../../domain/errors.ts'
import { createFakeStoreProvider } from './fakeStoreProvider.ts'

const upstream = {
  id: 7,
  title: 'Ring',
  price: 9.5,
  description: 'Shiny',
  category: 'jewelery',
  image: 'https://img.example/7.jpg',
  rating: { rate: 4.2, count: 10 },
}

const reply = (body: string, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch
const providerWith = (fetchFn: typeof fetch) => createFakeStoreProvider('https://store.test', fetchFn)

describe('fake store provider', () => {
  it('keeps the path prefix of the base URL when building request URLs', async () => {
    const urls: string[] = []
    const fetchFn = (async (url: URL) => {
      urls.push(String(url))
      return new Response('[]')
    }) as unknown as typeof fetch
    await createFakeStoreProvider('https://store.test/api/v1', fetchFn).list()
    expect(urls).toEqual(['https://store.test/api/v1/products'])
  })

  it('maps upstream fields to a Product', async () => {
    const [product] = await providerWith(reply(JSON.stringify([upstream]))).list()
    expect(product).toEqual({
      id: '7',
      title: 'Ring',
      price: 9.5,
      image: 'https://img.example/7.jpg',
      category: 'jewelery',
      description: 'Shiny',
      rating: 4.2,
    })
  })

  it('requests the product by id from the configured base url', async () => {
    let requested = ''
    const fetchFn = (async (url: URL) => {
      requested = String(url)
      return new Response(JSON.stringify(upstream))
    }) as unknown as typeof fetch
    await providerWith(fetchFn).getById('7')
    expect(requested).toBe('https://store.test/products/7')
  })

  it.each(['..', '.', 'a/b', 'a b', ''])('returns null without calling upstream for the unsafe id %j', async (id) => {
    let calls = 0
    const fetchFn = (async () => {
      calls++
      return new Response(JSON.stringify(upstream))
    }) as unknown as typeof fetch
    expect(await providerWith(fetchFn).getById(id)).toBeNull()
    expect(calls).toBe(0)
  })

  it('returns null for an unknown id answered with 404', async () => {
    expect(await providerWith(reply('', 404)).getById('99')).toBeNull()
  })

  it('returns null for an unknown id answered with an empty body', async () => {
    expect(await providerWith(reply('')).getById('99')).toBeNull()
  })

  it('lists categories', async () => {
    expect(await providerWith(reply('["a","b"]')).listCategories()).toEqual(['a', 'b'])
  })

  it('throws UpstreamError on a non-2xx response', async () => {
    await expect(providerWith(reply('boom', 500)).list()).rejects.toBeInstanceOf(UpstreamError)
  })

  it('throws UpstreamError, not null, when a product lookup gets a 500 with a valid-looking body', async () => {
    await expect(providerWith(reply(JSON.stringify(upstream), 500)).getById('7')).rejects.toBeInstanceOf(UpstreamError)
  })

  it('throws UpstreamError on invalid JSON', async () => {
    await expect(providerWith(reply('<html>')).list()).rejects.toBeInstanceOf(UpstreamError)
  })

  it('throws UpstreamError, not null, when a product lookup gets invalid JSON', async () => {
    await expect(providerWith(reply('<html>')).getById('7')).rejects.toBeInstanceOf(UpstreamError)
  })

  it('throws UpstreamError when a product is missing required fields', async () => {
    await expect(providerWith(reply('[{"id":1}]')).list()).rejects.toBeInstanceOf(UpstreamError)
  })

  it('throws UpstreamError on a network failure', async () => {
    const failing = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(providerWith(failing).list()).rejects.toBeInstanceOf(UpstreamError)
  })

  it('throws UpstreamError when the request times out', async () => {
    const timingOut = (async () => {
      throw new DOMException('timed out', 'TimeoutError')
    }) as unknown as typeof fetch
    await expect(providerWith(timingOut).getById('1')).rejects.toBeInstanceOf(UpstreamError)
  })
})
