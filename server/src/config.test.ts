import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'

const valid = {
  PORT: '3001',
  CLIENT_ORIGIN: 'http://localhost:5173',
  PRODUCT_SOURCE: 'fakestore',
  FAKESTORE_BASE_URL: 'https://fakestoreapi.com',
  FEATURED_PRODUCT_IDS: '1,2,3,4,5',
  MAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'catalogue@example.com',
  SALES_EMAIL: 'sales@example.com',
  TRUST_PROXY_HOPS: '0',
}

describe('loadConfig', () => {
  it('parses valid environment into typed values', () => {
    const config = loadConfig(valid)
    expect(config.PORT).toBe(3001)
    expect(config.FEATURED_PRODUCT_IDS).toEqual(['1', '2', '3', '4', '5'])
  })

  it('names every missing variable in the error', () => {
    expect(() => loadConfig({})).toThrow(/PORT[\s\S]*SALES_EMAIL/)
  })

  it('accepts a featured list that is not five ids', () => {
    expect(loadConfig({ ...valid, FEATURED_PRODUCT_IDS: ' 1, 2,,' }).FEATURED_PRODUCT_IDS).toEqual(['1', '2'])
  })

  it('fails when FEATURED_PRODUCT_IDS is missing', () => {
    const { FEATURED_PRODUCT_IDS: _omit, ...rest } = valid
    expect(() => loadConfig(rest)).toThrow(/FEATURED_PRODUCT_IDS/)
  })

  it('rejects an unknown product source', () => {
    expect(() => loadConfig({ ...valid, PRODUCT_SOURCE: 'nope' })).toThrow(/PRODUCT_SOURCE/)
  })

  it('rejects a product source base url that is not a url', () => {
    expect(() => loadConfig({ ...valid, FAKESTORE_BASE_URL: 'nope' })).toThrow(/FAKESTORE_BASE_URL/)
  })

  it('fails when MAIL_FROM is missing', () => {
    const { MAIL_FROM: _omit, ...rest } = valid
    expect(() => loadConfig(rest)).toThrow(/MAIL_FROM/)
  })

  it('rejects a MAIL_FROM that is not an email address', () => {
    expect(() => loadConfig({ ...valid, MAIL_FROM: 'nope' })).toThrow(/MAIL_FROM/)
  })

  it('fails when TRUST_PROXY_HOPS is missing', () => {
    const { TRUST_PROXY_HOPS: _omit, ...rest } = valid
    expect(() => loadConfig(rest)).toThrow(/TRUST_PROXY_HOPS/)
  })

  it('parses TRUST_PROXY_HOPS as a number', () => {
    expect(loadConfig({ ...valid, TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS).toBe(2)
  })

  it.each(['-1', '1.5', 'many'])('rejects TRUST_PROXY_HOPS %s', (value) => {
    expect(() => loadConfig({ ...valid, TRUST_PROXY_HOPS: value })).toThrow(/TRUST_PROXY_HOPS/)
  })
})
