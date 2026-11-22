import { z } from 'zod'
import { UpstreamError } from '../../domain/errors.ts'
import type { Product, ProductProvider } from '../../domain/product.ts'

const TIMEOUT_MS = 5000

const upstreamProduct = z.object({
  id: z.number(),
  title: z.string(),
  price: z.number(),
  description: z.string(),
  category: z.string(),
  image: z.string(),
  rating: z.object({ rate: z.number() }),
})
type UpstreamProduct = z.infer<typeof upstreamProduct>

function toProduct(p: UpstreamProduct): Product {
  return {
    id: String(p.id),
    title: p.title,
    price: p.price,
    image: p.image,
    category: p.category,
    description: p.description,
    rating: p.rating.rate,
  }
}

export function createFakeStoreProvider(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): ProductProvider {
  // A trailing slash plus relative paths keeps any path prefix on the base URL.
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  // Returns null only for a 404 or an empty body (Fake Store's answer for an unknown id).
  async function get(path: string): Promise<unknown> {
    let text: string
    try {
      const res = await fetchFn(new URL(path, base), { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (res.status === 404) return null
      if (!res.ok) throw new UpstreamError(`Fake Store responded ${res.status} for ${path}`)
      text = await res.text()
    } catch (err) {
      if (err instanceof UpstreamError) throw err
      throw new UpstreamError(`Fake Store request failed for ${path}`, { cause: err })
    }
    if (text.trim() === '') return null
    try {
      return JSON.parse(text)
    } catch (err) {
      throw new UpstreamError(`Fake Store returned invalid JSON for ${path}`, { cause: err })
    }
  }

  function parse<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new UpstreamError(`Fake Store returned unexpected data for ${path}`, { cause: result.error })
    }
    return result.data
  }

  return {
    async list() {
      return parse(z.array(upstreamProduct), await get('products'), '/products').map(toProduct)
    },
    async getById(id) {
      // Dot segments like '..' survive encoding and would resolve outside /products; such ids cannot exist upstream.
      if (!/^[\w-]+$/.test(id)) return null
      const data = await get(`products/${encodeURIComponent(id)}`)
      return data === null ? null : toProduct(parse(upstreamProduct, data, '/products/:id'))
    },
    async listCategories() {
      return parse(z.array(z.string()), await get('products/categories'), '/products/categories')
    },
  }
}
