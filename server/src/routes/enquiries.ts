import express, { Router } from 'express'
import { z } from 'zod'
import { ValidationError } from '../domain/errors.ts'
import type { EnquiryService } from '../services/enquiry.ts'
import { createRateLimit, rateLimitKey } from './rateLimit.ts'
import { idSchema } from './schemas.ts'

const LIMIT = 5
const WINDOW_MS = 10 * 60_000

const enquirySchema = z.object({
  name: z.string({ error: 'Enter your name.' }).trim()
    .min(1, 'Enter your name.').max(100, 'Use 100 characters or fewer.')
    .regex(/^[^\r\n]*$/, 'Enter your name on one line.'),
  email: z.string({ error: 'Enter a valid email address.' }).trim()
    .max(254, 'Enter a valid email address.')
    .pipe(z.email('Enter a valid email address.')),
  phone: z.string({ error: 'Enter a valid phone number.' }).trim()
    .max(30, 'Use 30 characters or fewer.')
    .regex(/^[\d\s+().-]*$/, 'Use digits, spaces and + - ( ) only.')
    .transform((v) => v || undefined).optional(),
  message: z.string({ error: 'Enter a message.' }).trim()
    .min(1, 'Enter a message.').max(2000, 'Use 2000 characters or fewer.'),
  // The client may also send title and price; they are stripped because the service re-fetches the product.
  product: z.object({
    id: z.union([z.string(), z.number()]).transform(String).pipe(idSchema),
  }, { error: 'That product is not valid.' }).optional(),
})

export function enquiriesRouter(enquiry: EnquiryService) {
  const router = Router()
  const limiter = createRateLimit({ limit: LIMIT, windowMs: WINDOW_MS })

  router.post('/enquiries', limiter, express.json({ limit: '10kb', strict: false }), async (req, res) => {
    // Arrays and scalars (strict: false lets them through) are treated like a missing body, so every required field is reported.
    const body: unknown = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {}
    // Read before validation so a bot sending otherwise invalid data still gets the same 201.
    const website: unknown = (body as { website?: unknown }).website
    if (typeof website === 'string' && website.trim() !== '') {
      console.warn(`enquiry honeypot hit ip=${rateLimitKey(req.ip ?? 'unknown')}`)
      res.status(201).json({ status: 'sent' })
      return
    }

    const parsed = enquirySchema.safeParse(body)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0])
        // A bad id inside product reports one message for the whole product field.
        fields[key] ??= key === 'product' ? 'That product is not valid.' : issue.message
      }
      throw new ValidationError(fields)
    }

    const { name, email, phone, message, product } = parsed.data
    await enquiry.submit({ name, email, phone, message, productId: product?.id })
    res.status(201).json({ status: 'sent' })
  })

  return router
}
