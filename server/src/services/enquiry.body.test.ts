import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeMailer, fakeProductProvider } from '../../test/helpers.ts'
import { createCatalogueService } from './catalogue.ts'
import { createEnquiryService } from './enquiry.ts'

afterEach(() => vi.restoreAllMocks())

function setup(title = 'Desk lamp', mailFails?: Error) {
  const mailer = fakeMailer(mailFails)
  const catalogue = createCatalogueService({ provider: fakeProductProvider([{ id: '7', title, price: 19.5 }]), featuredIds: [] })
  return { mailer, service: createEnquiryService({ mailer, catalogue, salesEmail: 'sales@example.com' }) }
}

const base = { name: 'Jo Smith', email: 'jo@example.com', phone: '020 7946 0000', message: 'Is it in stock?', productId: '7' }

describe('enquiry email content', () => {
  it('builds the exact message for a full enquiry', async () => {
    const { mailer, service } = setup()
    await service.submit(base)
    expect(mailer.sent).toEqual([
      {
        to: 'sales@example.com',
        subject: 'Enquiry: Desk lamp from Jo Smith',
        replyTo: 'jo@example.com',
        body: [
          'Product: Desk lamp (id 7), USD 19.5',
          'Name: Jo Smith',
          'Email: jo@example.com',
          'Phone: 020 7946 0000',
          '',
          'Message:',
          'Is it in stock?',
        ].join('\n'),
      },
    ])
  })

  it('takes the title from the provider', async () => {
    const { mailer, service } = setup('Real title')
    await service.submit(base)
    expect(mailer.sent[0]?.subject).toBe('Enquiry: Real title from Jo Smith')
  })

  it('does not split an emoji at the subject cut boundary', async () => {
    const { mailer, service } = setup()
    // The 24-character subject prefix plus 125 letters puts the emoji at UTF-16 index 149, where a plain slice(0, 150) would keep half of it.
    await service.submit({ ...base, name: 'a'.repeat(125) + '😀' + 'b'.repeat(10) })
    const subject = mailer.sent[0]!.subject
    expect(Array.from(subject)).toHaveLength(150)
    expect(subject.endsWith('😀')).toBe(true)
  })

  it('turns U+2028 and U+2029 in the name into spaces in the subject and body', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...base, name: 'Jo Bcc: x@y.co Smith' })
    expect(mailer.sent[0]!.subject).toBe('Enquiry: Desk lamp from Jo Bcc: x@y.co Smith')
    expect(mailer.sent[0]!.body).toContain('Name: Jo Bcc: x@y.co Smith')
  })

  it('ignores a client-sent title and price and uses the provider values', async () => {
    const { mailer, service } = setup('Real title')
    await service.submit({ ...base, product: { id: '7', title: 'CLIENT-LIE', price: 0.01 } } as typeof base)
    expect(mailer.sent[0]?.body).toContain('Product: Real title (id 7), USD 19.5')
    expect(mailer.sent[0]?.body).not.toContain('CLIENT-LIE')
  })

  it('sends to the configured sales address', async () => {
    const { mailer, service } = setup()
    await service.submit(base)
    expect(mailer.sent[0]?.to).toBe('sales@example.com')
  })

  it('sets reply-to to the customer email', async () => {
    const { mailer, service } = setup()
    await service.submit(base)
    expect(mailer.sent[0]?.replyTo).toBe('jo@example.com')
  })

  it('removes CR and LF from the subject when the name carries an injected header', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...base, name: 'Jo\r\nBcc: a@evil.test' })
    expect(mailer.sent[0]?.subject).not.toMatch(/[\r\n]/)
  })

  it('removes CR and LF from reply-to when the email carries an injected header', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...base, email: 'jo@example.com\r\nBcc: b@evil.test' })
    expect(mailer.sent[0]?.replyTo).not.toMatch(/[\r\n]/)
  })

  it('keeps an injected phone header out of the body as its own line', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...base, phone: '1\r\nBcc: c@evil.test' })
    expect(mailer.sent[0]?.body.split('\n').filter((l) => l.startsWith('Bcc:'))).toEqual([])
  })

  it('flattens a line break in the provider title in both subject and body', async () => {
    const { mailer, service } = setup('Lamp\r\nBcc: evil@example.com')
    await service.submit(base)
    expect(mailer.sent[0]?.subject).not.toMatch(/[\r\n]/)
    expect(mailer.sent[0]?.body.split('\n')[0]).toBe('Product: Lamp Bcc: evil@example.com (id 7), USD 19.5')
  })

  it('does not let a name with line breaks start a new body line', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...base, name: 'Jo\nMessage:\nfake' })
    expect(mailer.sent[0]?.body.split('\n')).toHaveLength(7)
  })

  it('does not let an email with line breaks start a new body line', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...base, email: 'a@b.co\nPhone: 1' })
    expect(mailer.sent[0]?.body.split('\n')).toHaveLength(7)
  })

  it('keeps html in the name as inert plain text', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...base, name: '<img src=x onerror=alert(1)>' })
    expect(mailer.sent[0]?.body).toContain('Name: <img src=x onerror=alert(1)>')
  })

  it('keeps html in the email as inert plain text', async () => {
    const { mailer, service } = setup()
    await service.submit({ ...base, email: '"<b>"@example.com' })
    expect(mailer.sent[0]?.body).toContain('Email: "<b>"@example.com')
  })

  it('cuts a long subject to 150 characters', async () => {
    const { mailer, service } = setup('T'.repeat(200))
    await service.submit(base)
    expect(Array.from(mailer.sent[0]!.subject)).toHaveLength(150)
  })

  it('puts the masked email and product id in the delivery error, not the name or message', async () => {
    const { service } = setup('Desk lamp', new Error('smtp down'))
    const err = (await service.submit({ ...base, name: 'Zebediah', message: 'Secret question' }).catch((e: unknown) => e)) as Error
    expect(err.message).toContain('jo***@example.com')
    expect(err.message).toContain('product=7')
    expect(err.message).not.toMatch(/Zebediah|Secret question/)
  })
})
