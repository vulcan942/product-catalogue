import express from 'express'
import type { Config } from './config.ts'
import type { CatalogueService } from './services/catalogue.ts'
import type { EnquiryService } from './services/enquiry.ts'
import { categoriesRouter } from './routes/categories.ts'
import { enquiriesRouter } from './routes/enquiries.ts'
import { errorHandler } from './routes/errorHandler.ts'
import { healthRouter } from './routes/health.ts'
import { productsRouter } from './routes/products.ts'

export function createApp(
  config: Pick<Config, 'CLIENT_ORIGIN' | 'TRUST_PROXY_HOPS'>,
  services: { catalogue: CatalogueService; enquiry: EnquiryService },
) {
  const app = express()
  app.disable('x-powered-by')
  // Makes req.ip the real client address behind nginx / a load balancer (used by the enquiry rate limit).
  app.set('trust proxy', config.TRUST_PROXY_HOPS)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', config.CLIENT_ORIGIN)
    res.setHeader('Vary', 'Origin')
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.sendStatus(204)
      return
    }
    next()
  })
  app.use('/api', healthRouter)
  app.use('/api', productsRouter(services.catalogue))
  app.use('/api', categoriesRouter(services.catalogue))
  app.use('/api', enquiriesRouter(services.enquiry))
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'We could not find that page.' } })
  })
  app.use(errorHandler)
  return app
}
