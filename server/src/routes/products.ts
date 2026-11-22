import { Router } from 'express'
import { z } from 'zod'
import { ValidationError } from '../domain/errors.ts'
import type { CatalogueService } from '../services/catalogue.ts'
import { idSchema, parsePaging } from './schemas.ts'
import { toCard, toDetail } from './wire.ts'

const MAX_QUERY = 100
const querySchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s+/g, ' '))
  .pipe(z.string().min(1).max(MAX_QUERY))

export function productsRouter(catalogue: CatalogueService) {
  const router = Router()

  // Registered before any /products/:id route so "featured" is never read as an id.
  router.get('/products/featured', async (_req, res) => {
    const products = await catalogue.getFeatured()
    res.json(products.map(toCard))
  })

  router.get('/products', async (req, res) => {
    // A repeated ?q=a&q=b arrives as an array and fails the string check, so it is a 400, not a 500.
    const parsed = querySchema.safeParse(req.query.q)
    const { paging, fields } = parsePaging(req.query)
    if (!parsed.success) {
      const tooLong = parsed.error.issues.some((i) => i.code === 'too_big')
      fields.q = tooLong ? `Use ${MAX_QUERY} characters or fewer.` : 'Enter a word to search for.'
    }
    if (!parsed.success || !paging) throw new ValidationError(fields)
    const result = await catalogue.search(parsed.data, paging)
    res.json({ ...result, products: result.products.map(toCard) })
  })

  // Registered last so "featured" is never read as an id.
  router.get('/products/:id', async (req, res) => {
    const parsed = idSchema.safeParse(req.params.id)
    if (!parsed.success) throw new ValidationError({ id: 'That product link is not valid.' })
    res.json(toDetail(await catalogue.getProduct(parsed.data)))
  })

  return router
}
