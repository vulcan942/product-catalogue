import { z } from 'zod'

const csvOfIds = z
  .string()
  .transform((s) => s.split(',').map((id) => id.trim()).filter(Boolean))

const schema = z.object({
  PORT: z.coerce.number().int().positive(),
  CLIENT_ORIGIN: z.url(),
  PRODUCT_SOURCE: z.enum(['fakestore']),
  FAKESTORE_BASE_URL: z.url(),
  FEATURED_PRODUCT_IDS: csvOfIds,
  MAIL_PROVIDER: z.enum(['smtp']),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  MAIL_FROM: z.email(),
  SALES_EMAIL: z.email(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0),
})

export type Config = z.infer<typeof schema>

// Fails at startup with every problem listed, so a bad .env is fixed in one pass.
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid configuration. Fix these environment variables:\n${problems}`)
  }
  return result.data
}
