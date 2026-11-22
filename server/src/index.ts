import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createMailer, createProductProvider } from './providers/index.ts'
import { createCatalogueService } from './services/catalogue.ts'
import { createEnquiryService } from './services/enquiry.ts'

let config
try {
  config = loadConfig(process.env)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const catalogue = createCatalogueService({
  provider: createProductProvider(config),
  featuredIds: config.FEATURED_PRODUCT_IDS,
})
const enquiry = createEnquiryService({ mailer: createMailer(config), catalogue, salesEmail: config.SALES_EMAIL })

createApp(config, { catalogue, enquiry }).listen(config.PORT, () => {
  console.info(`Server listening on port ${config.PORT}`)
})
