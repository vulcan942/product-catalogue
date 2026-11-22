import { Router } from 'express'
import { z } from 'zod'
import { ValidationError } from '../domain/errors.ts'
import type { CatalogueService } from '../services/catalogue.ts'
import { parsePaging } from './schemas.ts'
import { toCard } from './wire.ts'

const categorySchema = z.string().trim().min(1).max(64)

export function categoriesRouter(catalogue: CatalogueService) {
  const router = Router()

  router.get('/categories', async (_req, res) => {
    res.json(await catalogue.listCategories())
  })

  router.get('/categories/:category/products', async (req, res) => {
    const parsed = categorySchema.safeParse(req.params.category)
    const { paging, fields } = parsePaging(req.query)
    if (!parsed.success) fields.category = 'Enter a category name of 1 to 64 characters.'
    if (!parsed.success || !paging) throw new ValidationError(fields)
    const result = await catalogue.getCategoryPage(parsed.data, paging)
    res.json({ ...result, topRated: result.topRated.map(toCard), products: result.products.map(toCard) })
  })

  return router
}
