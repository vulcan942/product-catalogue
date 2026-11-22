import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.ts'
import type { Product } from '../domain/product.ts'
import { createCatalogueService } from '../services/catalogue.ts'
import { fakeProductProvider, noopEnquiry, testConfig } from '../../test/helpers.ts'

// The exact JSON below is copied by hand into client/src/pages/paging.contract.test.tsx.
// If a literal here changes, update the client copy: that is the drift check.

const servers: Array<{ close: () => void }> = []
afterEach(() => {
  servers.splice(0).forEach((s) => s.close())
  vi.restoreAllMocks()
})

// Ids 1..26 titled "Lamp n", rating 27 - id so ranking follows id. Ids 1..16 are in 'lighting' (remainder after the
// top three is 4..16, 13 products, so page 2 holds only 16); ids 17..26 are in 'other'. Search matches all 26.
const products: Product[] = Array.from({ length: 26 }, (_, i) => ({
  id: String(i + 1),
  title: `Lamp ${i + 1}`,
  category: i < 16 ? 'lighting' : 'other',
  rating: 26 - i,
}))

function start() {
  const catalogue = createCatalogueService({ provider: fakeProductProvider(products), featuredIds: [] })
  const server = createApp(testConfig, { catalogue, enquiry: noopEnquiry }).listen(0)
  servers.push(server)
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
}

describe('paged catalogue response contract (what the client parses)', () => {
  it('category page 2 is exactly the one remaining product with empty topRated', async () => {
    const res = await fetch(`${start()}/categories/lighting/products?page=2`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(
      '{"topRated":[],"products":[{"id":"16","title":"Lamp 16","category":"lighting"}],"page":2,"pageSize":12,"total":13}',
    )
  })

  it('search page 3 is exactly the last two matches with the match count as total', async () => {
    const res = await fetch(`${start()}/products?q=lamp&page=3`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(
      '{"products":[{"id":"25","title":"Lamp 25","category":"other"},{"id":"26","title":"Lamp 26","category":"other"}],"page":3,"pageSize":12,"total":26}',
    )
  })
})
