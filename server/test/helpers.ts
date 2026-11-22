import type { Mailer, MailMessage } from '../src/domain/mail.ts'
import type { Product, ProductProvider } from '../src/domain/product.ts'
import type { EnquiryService } from '../src/services/enquiry.ts'

export const testConfig = { CLIENT_ORIGIN: 'http://localhost:5173', TRUST_PROXY_HOPS: 0 }

// For tests that do not exercise enquiries but must pass a service to createApp.
export const noopEnquiry: EnquiryService = { submit: async () => {} }

// Fake Mailer that records messages. Pass `failWith` to make every send reject.
export function fakeMailer(failWith?: Error): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = []
  return {
    sent,
    async send(message) {
      if (failWith) throw failWith
      sent.push(message)
    },
  }
}

// Fake ProductProvider backed by an in-memory list. Pass `failWith` to make every call reject.
export function fakeProductProvider(products: Product[] = [], failWith?: Error): ProductProvider {
  const run = async <T>(value: () => T): Promise<T> => {
    if (failWith) throw failWith
    return value()
  }
  return {
    list: () => run(() => products),
    getById: (id) => run(() => products.find((p) => p.id === id) ?? null),
    listCategories: () => run(() => [...new Set(products.flatMap((p) => (p.category ? [p.category] : [])))]),
  }
}
