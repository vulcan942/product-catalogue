import type { Config } from '../config.ts'
import type { Mailer } from '../domain/mail.ts'
import type { ProductProvider } from '../domain/product.ts'
import { createFakeStoreProvider } from './fakestore/fakeStoreProvider.ts'
import { createSmtpMailer } from './smtp/smtpMailer.ts'

export function createMailer(config: Config): Mailer {
  switch (config.MAIL_PROVIDER) {
    case 'smtp':
      return createSmtpMailer({ host: config.SMTP_HOST, port: config.SMTP_PORT, from: config.MAIL_FROM })
  }
}

// Composition root for the product source: the only place that knows which adapters exist.
export function createProductProvider(config: Config): ProductProvider {
  switch (config.PRODUCT_SOURCE) {
    case 'fakestore':
      return createFakeStoreProvider(config.FAKESTORE_BASE_URL)
  }
}
