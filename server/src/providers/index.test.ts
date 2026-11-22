import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../config.ts'
import { createProductProvider } from './index.ts'

describe('createProductProvider', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('builds the Fake Store provider against FAKESTORE_BASE_URL when PRODUCT_SOURCE is fakestore', async () => {
    const config = loadConfig({
      PORT: '1',
      CLIENT_ORIGIN: 'http://localhost:5173',
      PRODUCT_SOURCE: 'fakestore',
      FAKESTORE_BASE_URL: 'https://store.test',
      FEATURED_PRODUCT_IDS: '1,2,3,4,5',
      MAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'h',
      SMTP_PORT: '1',
      MAIL_FROM: 'a@b.co',
      SALES_EMAIL: 'a@b.co',
      TRUST_PROXY_HOPS: '0',
    })
    const fetchSpy = vi.fn(async (_url: URL | string) => new Response('[]'))
    vi.stubGlobal('fetch', fetchSpy)
    await createProductProvider(config).list()
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('https://store.test/products')
  })
})
