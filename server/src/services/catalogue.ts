import { NotFoundError } from '../domain/errors.ts'
import type { Product, ProductProvider } from '../domain/product.ts'

const TOP_RATED_COUNT = 3

export interface PageRequest {
  page: number
  pageSize: number
}

export interface CatalogueService {
  getFeatured(): Promise<Product[]>
  listCategories(): Promise<string[]>
  getCategoryPage(
    category: string,
    paging: PageRequest,
  ): Promise<PageRequest & { topRated: Product[]; products: Product[]; total: number }>
  search(term: string, paging: PageRequest): Promise<PageRequest & { products: Product[]; total: number }>
  getProduct(id: string): Promise<Product>
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length }
}

// Rating descending, unrated last, ties by id (numeric-aware so "2" sorts before "10").
function byRanking(a: Product, b: Product): number {
  const diff = (b.rating ?? -Infinity) - (a.rating ?? -Infinity)
  if (diff !== 0 && !Number.isNaN(diff)) return diff
  return a.id.localeCompare(b.id, undefined, { numeric: true })
}

export function createCatalogueService(deps: { provider: ProductProvider; featuredIds: string[] }): CatalogueService {
  return {
    async getFeatured() {
      const found = await Promise.all(deps.featuredIds.map((id) => deps.provider.getById(id)))
      const featured: Product[] = []
      found.forEach((product, i) => {
        if (product) featured.push(product)
        else console.warn(`Featured product ${deps.featuredIds[i]} not found, skipping`)
      })
      return featured
    },

    listCategories: () => deps.provider.listCategories(),

    // Literal substring match (no regex) so characters like "(" or ".*" are safe. Provider order, no ranking.
    async search(term, { page, pageSize }) {
      const needle = term.toLowerCase()
      const matches = (await deps.provider.list()).filter(
        (p) => p.title.toLowerCase().includes(needle) || (p.description ?? '').toLowerCase().includes(needle),
      )
      const { items, total } = paginate(matches, page, pageSize)
      return { products: items, page, pageSize, total }
    },

    async getProduct(id) {
      const product = await deps.provider.getById(id)
      if (!product) throw new NotFoundError(`Unknown product "${id}"`)
      return product
    },

    async getCategoryPage(category, { page, pageSize }) {
      const categories = await deps.provider.listCategories()
      if (!categories.includes(category)) throw new NotFoundError(`Unknown category "${category}"`)
      const sorted = (await deps.provider.list()).filter((p) => p.category === category).sort(byRanking)
      const { items, total } = paginate(sorted.slice(TOP_RATED_COUNT), page, pageSize)
      // Top rated shows on page 1 only; repeating it on every page is noise.
      return { topRated: page === 1 ? sorted.slice(0, TOP_RATED_COUNT) : [], products: items, page, pageSize, total }
    },
  }
}
