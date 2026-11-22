import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.ts'
import { createCatalogueService } from '../services/catalogue.ts'
import { createEnquiryService } from '../services/enquiry.ts'
import { fakeMailer, fakeProductProvider, testConfig } from '../../test/helpers.ts'

// The exact JSON below is copied into client/src/components/EnquiryForm.contract.test.tsx.
// If a literal here changes, update the client copy: that is the drift check.

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

function start(mailFails?: Error) {
  const catalogue = createCatalogueService({ provider: fakeProductProvider([{ id: '7', title: 'Desk lamp', price: 19.5 }]), featuredIds: [] })
  const enquiry = createEnquiryService({ mailer: fakeMailer(mailFails), catalogue, salesEmail: 'sales@example.com' })
  const server = createApp(testConfig, { catalogue, enquiry }).listen(0)
  servers.push(server)
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/enquiries`
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('enquiry response contract (what the client parses)', () => {
  it('201 is exactly {"status":"sent"}', async () => {
    const res = await post(start(), { name: 'Jo', email: 'jo@example.com', message: 'Hi' })
    expect(res.status).toBe(201)
    expect(await res.text()).toBe('{"status":"sent"}')
  })

  it('400 keys every field by the names the form uses: name, email, phone, message, product', async () => {
    const res = await post(start(), { name: '', email: 'x', phone: 'abc', message: '', product: { id: '../x' } })
    expect(res.status).toBe(400)
    expect(await res.text()).toBe(
      JSON.stringify({
        error: {
          code: 'validation_failed',
          message: 'Check the highlighted fields.',
          fields: {
            name: 'Enter your name.',
            email: 'Enter a valid email address.',
            phone: 'Use digits, spaces and + - ( ) only.',
            message: 'Enter a message.',
            product: 'That product is not valid.',
          },
        },
      }),
    )
  })

  it('429 is exactly the rate_limited error shape', async () => {
    const url = start()
    for (let i = 0; i < 5; i++) await post(url, {})
    const res = await post(url, {})
    expect(res.status).toBe(429)
    expect(await res.text()).toBe(
      '{"error":{"code":"rate_limited","message":"You have sent several enquiries. Try again in a few minutes."}}',
    )
  })

  it('502 is exactly the enquiry_not_sent error shape', async () => {
    const res = await post(start(new Error('smtp down')), { name: 'Jo', email: 'jo@example.com', message: 'Hi' })
    expect(res.status).toBe(502)
    expect(await res.text()).toBe(
      '{"error":{"code":"enquiry_not_sent","message":"We could not send your enquiry. Try again in a moment."}}',
    )
  })

  it('413 is exactly the payload_too_large error shape', async () => {
    const res = await post(start(), { name: 'Jo', email: 'jo@example.com', message: 'x'.repeat(11 * 1024) })
    expect(res.status).toBe(413)
    expect(await res.text()).toBe(
      '{"error":{"code":"payload_too_large","message":"That enquiry is too large. Shorten your message and try again."}}',
    )
  })

  it('accepts the exact payload the client sends, including product title and price', async () => {
    const res = await post(start(), {
      name: 'Jo', email: 'jo@example.com', phone: '+44 20', message: 'Hi',
      product: { id: '7', title: 'Desk lamp', price: 19.5 },
    })
    expect(res.status).toBe(201)
  })
})
