import { afterEach, describe, expect, it, vi } from 'vitest'
import { MailDeliveryError, NotFoundError, UpstreamError } from '../domain/errors.ts'
import { fakeMailer, fakeProductProvider } from '../../test/helpers.ts'
import { createCatalogueService } from './catalogue.ts'
import { createEnquiryService } from './enquiry.ts'

afterEach(() => vi.restoreAllMocks())

const lamp = { id: '7', title: 'Desk lamp', price: 19.5 }
const input = { name: 'Jo Smith', email: 'jo.smith@example.com', message: 'Is it in stock?' }

function setup(options: { mailFails?: Error; providerFails?: Error } = {}) {
  const mailer = fakeMailer(options.mailFails)
  const catalogue = createCatalogueService({ provider: fakeProductProvider([lamp], options.providerFails), featuredIds: [] })
  const service = createEnquiryService({ mailer, catalogue, salesEmail: 'sales@example.com' })
  return { mailer, service }
}

function logged() {
  const spies = [vi.spyOn(console, 'info'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')]
  return () => JSON.stringify(spies.flatMap((s) => s.mock.calls.map((c) => c.map((a) => (a instanceof Error ? a.stack : a)))))
}

describe('enquiry service', () => {
  it('sends one email to the sales address with the customer details in the body', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...input, phone: '+44 20 7946 0000' })
    expect(mailer.sent).toHaveLength(1)
    const [mail] = mailer.sent
    expect(mail?.to).toBe('sales@example.com')
    expect(mail?.body).toContain('Name: Jo Smith')
    expect(mail?.body).toContain('Email: jo.smith@example.com')
    expect(mail?.body).toContain('Phone: +44 20 7946 0000')
    expect(mail?.body).toContain('Is it in stock?')
  })

  it('puts the provider product title, id and price in the email, not client data', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...input, productId: '7' })
    expect(mailer.sent[0]?.body).toContain('Product: Desk lamp (id 7), USD 19.5')
    expect(mailer.sent[0]?.subject).toBe('Enquiry: Desk lamp from Jo Smith')
  })

  it('says No product and Not given when there is no product or phone', async () => {
    const { mailer, service } = setup()
    await service.submit(input)
    expect(mailer.sent[0]?.body).toContain('No product')
    expect(mailer.sent[0]?.body).toContain('Phone: Not given')
    expect(mailer.sent[0]?.subject).toBe('Enquiry from Jo Smith')
  })

  it('sets reply-to to the customer email', async () => {
    const { mailer, service } = setup()
    await service.submit(input)
    expect(mailer.sent[0]?.replyTo).toBe('jo.smith@example.com')
  })

  it('strips line breaks from the subject so a name cannot add headers', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...input, name: 'Jo\r\nBcc: evil@example.com' })
    expect(mailer.sent[0]?.subject).not.toMatch(/[\r\n]/)
  })

  it('strips line breaks from reply-to so an email cannot add headers', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...input, email: 'jo@example.com\r\nBcc: evil@example.com' })
    expect(mailer.sent[0]?.replyTo).not.toMatch(/[\r\n]/)
  })

  it('cuts the subject to 150 characters', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...input, name: 'x'.repeat(300) })
    expect(mailer.sent[0]?.subject).toHaveLength(150)
  })

  it('keeps html and script text as plain text', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...input, message: '<script>alert(1)</script><b>hi</b>' })
    expect(mailer.sent[0]?.body).toContain('<script>alert(1)</script><b>hi</b>')
  })

  it('keeps message line breaks and removes other control characters', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...input, message: 'one\r\ntwo\u0000\u0007' })
    expect(mailer.sent[0]?.body.endsWith('one\ntwo')).toBe(true)
  })

  it('rejects with NotFoundError and sends nothing for an unknown product', async () => {
    const { mailer, service } = setup()
    await expect(service.submit({ ...input, productId: '999' })).rejects.toBeInstanceOf(NotFoundError)
    expect(mailer.sent).toHaveLength(0)
  })

  it('propagates an upstream error and sends nothing when the product lookup fails', async () => {
    const { mailer, service } = setup({ providerFails: new UpstreamError('down') })
    await expect(service.submit({ ...input, productId: '7' })).rejects.toBeInstanceOf(UpstreamError)
    expect(mailer.sent).toHaveLength(0)
  })

  it('wraps a mailer failure in MailDeliveryError and keeps the cause', async () => {
    const cause = new Error('smtp down')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { service } = setup({ mailFails: cause })
    const err = await service.submit(input).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MailDeliveryError)
    expect((err as MailDeliveryError).cause).toBe(cause)
  })

  it('logs a masked email and never the name, phone or message', async () => {
    const read = logged()
    const { service } = setup()
    await service.submit({ ...input, name: 'Zebediah', phone: '555 0100 777', message: 'Secret question' })
    const output = read()
    expect(output).toContain('jo***@example.com')
    expect(output).not.toContain('jo.smith')
    expect(output).not.toContain('Zebediah')
    expect(output).not.toContain('555 0100 777')
    expect(output).not.toContain('Secret question')
  })

  it('logs no customer text when sending fails', async () => {
    const read = logged()
    const { service } = setup({ mailFails: new Error('smtp down') })
    await service.submit({ ...input, name: 'Zebediah', message: 'Secret question' }).catch(() => {})
    expect(read()).not.toMatch(/Zebediah|Secret question/)
  })
})
