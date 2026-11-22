import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.ts'
import { UpstreamError } from '../domain/errors.ts'
import { createCatalogueService } from '../services/catalogue.ts'
import { createEnquiryService } from '../services/enquiry.ts'
import { fakeMailer, fakeProductProvider, testConfig } from '../../test/helpers.ts'

const servers: Array<{ close: () => void }> = []
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  servers.splice(0).forEach((s) => s.close())
  vi.restoreAllMocks()
})

function start(options: { mailFails?: Error; providerFails?: Error; trustProxyHops?: number } = {}) {
  const mailer = fakeMailer(options.mailFails)
  const catalogue = createCatalogueService({
    provider: fakeProductProvider([{ id: '7', title: 'Desk lamp', price: 19.5 }], options.providerFails),
    featuredIds: [],
  })
  const enquiry = createEnquiryService({ mailer, catalogue, salesEmail: 'sales@example.com' })
  const config = { ...testConfig, TRUST_PROXY_HOPS: options.trustProxyHops ?? 0 }
  const server = createApp(config, { catalogue, enquiry }).listen(0)
  servers.push(server)
  return { mailer, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/enquiries` }
}

const valid = { name: 'Jo Smith', email: 'jo@example.com', message: 'Is it in stock?' }

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

describe('POST /api/enquiries', () => {
  it('returns 201 sent and emails the details and the provider product', async () => {
    const { url, mailer } = start()
    const res = await post(url, { ...valid, phone: '020 7946 0000', product: { id: 7, title: 'Fake', price: 1 } })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ status: 'sent' })
    expect(mailer.sent).toHaveLength(1)
    expect(mailer.sent[0]?.body).toContain('Jo Smith')
    expect(mailer.sent[0]?.body).toContain('jo@example.com')
    expect(mailer.sent[0]?.body).toContain('020 7946 0000')
    expect(mailer.sent[0]?.body).toContain('Desk lamp (id 7), USD 19.5')
    expect(mailer.sent[0]?.body).not.toContain('Fake')
  })

  it('accepts a blank phone as absent', async () => {
    const { url, mailer } = start()
    expect((await post(url, { ...valid, phone: '  ' })).status).toBe(201)
    expect(mailer.sent[0]?.body).toContain('Phone: Not given')
  })

  it('returns 201 and sends nothing when the honeypot is filled', async () => {
    const { url, mailer } = start()
    const res = await post(url, { ...valid, website: 'http://spam.example' })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ status: 'sent' })
    expect(mailer.sent).toHaveLength(0)
  })

  it('returns the honeypot 201 even when the rest of the body is invalid', async () => {
    const { url, mailer } = start()
    const res = await post(url, { website: 'x' })
    expect(res.status).toBe(201)
    expect(mailer.sent).toHaveLength(0)
  })

  it.each([
    ['name missing', { ...valid, name: undefined }, 'name', 'Enter your name.'],
    ['name blank', { ...valid, name: '   ' }, 'name', 'Enter your name.'],
    ['name too long', { ...valid, name: 'x'.repeat(101) }, 'name', 'Use 100 characters or fewer.'],
    ['name with a line break', { ...valid, name: 'Jo\r\nBcc: a@b.co' }, 'name', 'Enter your name on one line.'],
    ['email missing', { ...valid, email: undefined }, 'email', 'Enter a valid email address.'],
    ['email invalid', { ...valid, email: 'not-an-email' }, 'email', 'Enter a valid email address.'],
    ['email with a line break', { ...valid, email: 'jo@example.com\r\nBcc: a@b.co' }, 'email', 'Enter a valid email address.'],
    ['email too long', { ...valid, email: `${'a'.repeat(250)}@example.com` }, 'email', 'Enter a valid email address.'],
    ['message missing', { ...valid, message: undefined }, 'message', 'Enter a message.'],
    ['message blank', { ...valid, message: '  ' }, 'message', 'Enter a message.'],
    ['message too long', { ...valid, message: 'x'.repeat(2001) }, 'message', 'Use 2000 characters or fewer.'],
    ['phone with letters', { ...valid, phone: 'call me' }, 'phone', 'Use digits, spaces and + - ( ) only.'],
    ['phone too long', { ...valid, phone: '1'.repeat(31) }, 'phone', 'Use 30 characters or fewer.'],
    ['product id unsafe', { ...valid, product: { id: '../x' } }, 'product', 'That product is not valid.'],
    ['product not an object', { ...valid, product: 'lamp' }, 'product', 'That product is not valid.'],
  ])('returns 400 with a field message when %s', async (_label, body, field, message) => {
    const { url, mailer } = start()
    const res = await post(url, body)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: { code: 'validation_failed', message: 'Check the highlighted fields.', fields: { [field]: message } },
    })
    expect(mailer.sent).toHaveLength(0)
  })

  it('lists every required field when the body is not JSON', async () => {
    const { url } = start()
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: { fields: Record<string, string> } }
    expect(Object.keys(json.error.fields).sort()).toEqual(['email', 'message', 'name'])
  })

  it.each([
    ['an array', '[1, 2]'],
    ['a string', '"hello"'],
  ])('lists every required field when the JSON body is %s', async (_label, body) => {
    const { url, mailer } = start()
    const res = await post(url, body)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: { code: string; fields: Record<string, string> } }
    expect(json.error.code).toBe('validation_failed')
    expect(Object.keys(json.error.fields).sort()).toEqual(['email', 'message', 'name'])
    expect(mailer.sent).toHaveLength(0)
  })

  it('returns 400 bad_request for malformed JSON', async () => {
    const { url } = start()
    const res = await post(url, '{"name": ')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: { code: 'bad_request', message: 'The request could not be read.' } })
  })

  it('returns 413 payload_too_large for a body over 10 kb', async () => {
    const { url, mailer } = start()
    const res = await post(url, { ...valid, message: 'x'.repeat(11 * 1024) })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({
      error: { code: 'payload_too_large', message: 'That enquiry is too large. Shorten your message and try again.' },
    })
    expect(mailer.sent).toHaveLength(0)
  })

  it('returns 404 and sends nothing for an unknown product', async () => {
    const { url, mailer } = start()
    const res = await post(url, { ...valid, product: { id: '999' } })
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found')
    expect(mailer.sent).toHaveLength(0)
  })

  it('returns 502 upstream_unavailable when the product source is down', async () => {
    const { url, mailer } = start({ providerFails: new UpstreamError('down') })
    const res = await post(url, { ...valid, product: { id: '7' } })
    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('upstream_unavailable')
    expect(mailer.sent).toHaveLength(0)
  })

  it('returns 502 enquiry_not_sent and never reports success when the mailer fails', async () => {
    const { url } = start({ mailFails: new Error('smtp down') })
    const res = await post(url, valid)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: { code: 'enquiry_not_sent', message: 'We could not send your enquiry. Try again in a moment.' },
    })
  })

  it('logs a mail failure once with the masked email and product id but no name, phone or message', async () => {
    const { url } = start({ mailFails: new Error('smtp down') })
    const res = await post(url, { ...valid, phone: '020 7946 0000', message: 'Secret question', product: { id: 7 } })
    expect(res.status).toBe(502)
    const errors = vi.mocked(console.error).mock.calls
    expect(errors).toHaveLength(1)
    const text = errors[0]!.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')
    expect(text).toContain('jo***@example.com')
    expect(text).toContain('product=7')
    for (const secret of ['Jo Smith', '020 7946 0000', 'Secret question']) expect(text).not.toContain(secret)
  })

  it('does not leak the mailer error text to the client', async () => {
    const { url } = start({ mailFails: new Error('smtp password rejected') })
    expect(await (await post(url, valid)).text()).not.toContain('password')
  })

  it('returns 429 with Retry-After on the sixth request and sends no sixth email', async () => {
    const { url, mailer } = start()
    for (let i = 0; i < 5; i++) expect((await post(url, valid)).status).toBe(201)
    const res = await post(url, valid)
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await res.json()).toEqual({
      error: { code: 'rate_limited', message: 'You have sent several enquiries. Try again in a few minutes.' },
    })
    expect(mailer.sent).toHaveLength(5)
  })

  it('counts invalid requests against the limit', async () => {
    const { url } = start()
    for (let i = 0; i < 5; i++) expect((await post(url, {})).status).toBe(400)
    expect((await post(url, valid)).status).toBe(429)
  })

  it('counts malformed JSON and oversize bodies against the limit', async () => {
    const { url } = start()
    for (let i = 0; i < 3; i++) expect((await post(url, '{"name": ')).status).toBe(400)
    for (let i = 0; i < 2; i++) expect((await post(url, { ...valid, message: 'x'.repeat(11 * 1024) })).status).toBe(413)
    expect((await post(url, valid)).status).toBe(429)
  })

  it('counts honeypot hits against the limit', async () => {
    const { url } = start()
    for (let i = 0; i < 5; i++) expect((await post(url, { ...valid, website: 'x' })).status).toBe(201)
    expect((await post(url, valid)).status).toBe(429)
  })

  it('ignores a spoofed X-Forwarded-For when no proxy is trusted', async () => {
    const { url } = start({ trustProxyHops: 0 })
    for (let i = 0; i < 5; i++) await post(url, valid, { 'X-Forwarded-For': `9.9.9.${i}` })
    expect((await post(url, valid, { 'X-Forwarded-For': '9.9.9.200' })).status).toBe(429)
  })

  it('keys the limit on the address a trusted proxy reports', async () => {
    const { url } = start({ trustProxyHops: 1 })
    for (let i = 0; i < 5; i++) await post(url, valid, { 'X-Forwarded-For': '8.8.8.8' })
    expect((await post(url, valid, { 'X-Forwarded-For': '8.8.8.8' })).status).toBe(429)
    expect((await post(url, valid, { 'X-Forwarded-For': '7.7.7.7' })).status).toBe(201)
  })
})

describe('OPTIONS /api/enquiries', () => {
  it('answers the preflight with 204 and the allowed method, header and origin', async () => {
    const { url } = start()
    const res = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST')
    expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type')
  })

  it('never allows an origin other than CLIENT_ORIGIN', async () => {
    const { url } = start()
    const res = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'http://evil.example' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('does not count preflights against the rate limit', async () => {
    const { url } = start()
    for (let i = 0; i < 6; i++) await fetch(url, { method: 'OPTIONS' })
    expect((await post(url, valid)).status).toBe(201)
  })
})
