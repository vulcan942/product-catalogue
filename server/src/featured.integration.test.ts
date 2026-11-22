import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.ts'
import type { Product } from './domain/product.ts'
import { createCatalogueService } from './services/catalogue.ts'
import { fakeProductProvider, noopEnquiry, testConfig } from '../test/helpers.ts'

const servers: Array<{ close: () => void }> = []
afterEach(() => {
  servers.splice(0).forEach((s) => s.close())
  vi.restoreAllMocks()
})

const full = (id: string): Product => ({
  id, title: `Product ${id}`, price: 10, image: `${id}.png`, category: 'cat', description: 'long text', rating: 4.2,
})

async function getFeatured(featuredIds: string[]) {
  const catalogue = createCatalogueService({ provider: fakeProductProvider(['1', '2', '3', '4', '5', '6'].map(full)), featuredIds })
  const server = createApp(testConfig, { catalogue, enquiry: noopEnquiry }).listen(0)
  servers.push(server)
  return fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/products/featured`)
}

describe('GET /api/products/featured with the real service and a fake provider', () => {
  it('returns exactly the configured products in configured order', async () => {
    const body = (await (await getFeatured(['5', '2', '4', '1', '3'])).json()) as Array<{ id: string }>
    expect(body.map((p) => p.id)).toEqual(['5', '2', '4', '1', '3'])
  })

  it('omits a configured id the provider does not have', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const body = (await (await getFeatured(['1', '99', '2'])).json()) as Array<{ id: string }>
    expect(body.map((p) => p.id)).toEqual(['1', '2'])
  })

  it('returns only the card fields', async () => {
    const [first] = (await (await getFeatured(['1'])).json()) as Array<Record<string, unknown>>
    expect(Object.keys(first).sort()).toEqual(['category', 'id', 'image', 'price', 'title'])
  })
})
