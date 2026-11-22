import { MailDeliveryError } from '../domain/errors.ts'
import type { Mailer } from '../domain/mail.ts'
import type { CatalogueService } from './catalogue.ts'

export interface EnquiryInput {
  name: string
  email: string
  phone?: string
  message: string
  productId?: string
}

export interface EnquiryService {
  submit(input: EnquiryInput): Promise<void>
}

const MAX_SUBJECT = 150

// Line breaks and control characters (incl. U+2028/2029) become a space so a value can never start a new mail header.
const oneLine = (s: string) => s.replace(/[\p{Cc}\u2028\u2029]+/gu, ' ').trim()

// Keeps the customer's line breaks, drops every other control character.
const multiLine = (s: string) =>
  s.replace(/\r\n?/g, '\n').replace(/[^\P{Cc}\n]/gu, '')

// jo***@example.com: enough to find the enquiry, not enough to contact the customer.
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  const local = email.slice(0, at)
  return `${local.slice(0, Math.min(2, local.length))}***${email.slice(at)}`
}

export function createEnquiryService(deps: {
  mailer: Mailer
  catalogue: Pick<CatalogueService, 'getProduct'>
  salesEmail: string
}): EnquiryService {
  return {
    async submit(input) {
      // Re-fetched so the email shows real product data, not what the client claims. Throws NotFoundError / UpstreamError.
      const product = input.productId ? await deps.catalogue.getProduct(input.productId) : undefined
      const name = oneLine(input.name)
      const email = oneLine(input.email)
      const title = product ? oneLine(product.title) : undefined
      // prices are USD (Fake Store); read from the provider if a source ever differs
      const price = product?.price === undefined ? '' : `, USD ${product.price}`
      const productLine = product ? `Product: ${title} (id ${oneLine(product.id)})${price}` : 'No product'

      const body = [
        productLine,
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${input.phone ? oneLine(input.phone) : 'Not given'}`,
        '',
        'Message:',
        multiLine(input.message),
      ].join('\n')
      // Cut by code point so an emoji is never split into a lone surrogate.
      const subject = Array.from(oneLine(title ? `Enquiry: ${title} from ${name}` : `Enquiry from ${name}`)).slice(0, MAX_SUBJECT).join('')
      const context = `product=${product?.id ?? 'none'} email=${maskEmail(email)}`

      try {
        await deps.mailer.send({ to: deps.salesEmail, subject, body, replyTo: email })
      } catch (cause) {
        // Logged once by the error handler; the context rides in the message.
        throw new MailDeliveryError(`Enquiry email not delivered ${context}`, { cause })
      }
      console.info(`enquiry sent ${context}`)
    },
  }
}
