import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { createCatalogueService } from './services/catalogue.ts'
import { fakeProductProvider, noopEnquiry, testConfig } from '../test/helpers.ts'

const servers: Array<{ close: () => void }> = []
afterEach(() => servers.splice(0).forEach((s) => s.close()))

function start() {
  const server = createApp(testConfig, { catalogue: createCatalogueService({ provider: fakeProductProvider(), featuredIds: [] }), enquiry: noopEnquiry }).listen(0)
  servers.push(server)
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await fetch(`${start()}/api/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('allows only the configured client origin', async () => {
    const res = await fetch(`${start()}/api/health`)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('blocks requests to hosts other than localhost', async () => {
    await expect(fetch('https://fakestoreapi.com/products')).rejects.toThrow(/Network blocked/)
  })
})
