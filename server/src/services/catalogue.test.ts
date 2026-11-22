import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, UpstreamError } from '../domain/errors.ts'
import type { Product } from '../domain/product.ts'
import { fakeProductProvider } from '../../test/helpers.ts'
import { createCatalogueService } from './catalogue.ts'

const p = (id: string): Product => ({ id, title: `Product ${id}` })
const all = ['1', '2', '3', '4', '5'].map(p)

afterEach(() => vi.restoreAllMocks())

describe('getFeatured', () => {
  it('returns products in the configured order', async () => {
    const svc = createCatalogueService({ provider: fakeProductProvider(all), featuredIds: ['3', '1', '2'] })
    expect((await svc.getFeatured()).map((x) => x.id)).toEqual(['3', '1', '2'])
  })

  it('skips a missing product and logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const svc = createCatalogueService({ provider: fakeProductProvider(all), featuredIds: ['1', '99', '2'] })
    expect((await svc.getFeatured()).map((x) => x.id)).toEqual(['1', '2'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('99'))
  })

  it('propagates an upstream error', async () => {
    const svc = createCatalogueService({ provider: fakeProductProvider(all, new UpstreamError('down')), featuredIds: ['1'] })
    await expect(svc.getFeatured()).rejects.toBeInstanceOf(UpstreamError)
  })

  it('works when the configured list is not five ids', async () => {
    const svc = createCatalogueService({ provider: fakeProductProvider(all), featuredIds: ['1', '2'] })
    expect(await svc.getFeatured()).toHaveLength(2)
  })
})

describe('getProduct', () => {
  const svc = (provider = fakeProductProvider(all)) => createCatalogueService({ provider, featuredIds: [] })

  it('returns the product with that id', async () => {
    expect((await svc().getProduct('2')).id).toBe('2')
  })

  it('throws NotFoundError when the provider has no such product', async () => {
    await expect(svc().getProduct('99')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('propagates an upstream error', async () => {
    await expect(svc(fakeProductProvider(all, new UpstreamError('down'))).getProduct('1')).rejects.toBeInstanceOf(UpstreamError)
  })
})

const rated = (id: string, rating?: number, category = 'men'): Product => ({ id, title: `Product ${id}`, category, rating })
const page = (products: Product[], category = 'men', paging = { page: 1, pageSize: 12 }) =>
  createCatalogueService({ provider: fakeProductProvider(products), featuredIds: [] }).getCategoryPage(category, paging)
const ids = (products: Product[]) => products.map((x) => x.id)

describe('getCategoryPage', () => {
  it('puts the three highest rated first, best first', async () => {
    const r = await page([rated('1', 3), rated('2', 5), rated('3', 4), rated('4', 4.5), rated('5', 1)])
    expect(ids(r.topRated)).toEqual(['2', '4', '3'])
  })

  it('lists the remaining products after the top rated, in ranking order', async () => {
    const r = await page([rated('1', 3), rated('2', 5), rated('3', 4), rated('4', 4.5), rated('5', 1)])
    expect(ids(r.products)).toEqual(['1', '5'])
  })

  it('breaks rating ties by id with numeric ordering', async () => {
    const r = await page([rated('10', 4), rated('2', 4), rated('1', 4)])
    expect(ids(r.topRated)).toEqual(['1', '2', '10'])
  })

  it('ranks products without a rating last', async () => {
    const r = await page([rated('1'), rated('2', 2), rated('3'), rated('4', 3)])
    expect(ids([...r.topRated, ...r.products])).toEqual(['4', '2', '1', '3'])
  })

  it('never repeats a product between topRated and products', async () => {
    const r = await page([1, 2, 3, 4, 5, 6].map((n) => rated(String(n), n)))
    expect(new Set([...ids(r.topRated), ...ids(r.products)]).size).toBe(6)
  })

  it('leaves products empty when the category has three or fewer', async () => {
    const r = await page([rated('1', 1), rated('2', 2), rated('3', 3)])
    expect(r.products).toEqual([])
  })

  it('only returns products from the requested category', async () => {
    const r = await page([rated('1', 1), rated('2', 2, 'women')])
    expect(ids(r.topRated)).toEqual(['1'])
  })

  it('throws NotFoundError for an unknown category', async () => {
    await expect(page([rated('1', 1)], 'toys')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('treats category names as case sensitive', async () => {
    await expect(page([rated('1', 1)], 'Men')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('returns empty lists for a known category with no products', async () => {
    const provider = { ...fakeProductProvider([]), listCategories: async () => ['men'] }
    const svc = createCatalogueService({ provider, featuredIds: [] })
    expect(await svc.getCategoryPage('men', { page: 1, pageSize: 12 })).toEqual({
      topRated: [],
      products: [],
      page: 1,
      pageSize: 12,
      total: 0,
    })
  })
})

describe('getCategoryPage paging', () => {
  // ratings 10..1 give ids 'n' with rating n; ranking order is 10,9,...,1; top three are 10,9,8; remainder is 7..1 (7 items)
  const ten = Array.from({ length: 10 }, (_, i) => rated(String(10 - i), 10 - i))

  it('returns the first page of the remainder with top rated and the remainder total', async () => {
    const r = await page(ten, 'men', { page: 1, pageSize: 3 })
    expect(ids(r.topRated)).toEqual(['10', '9', '8'])
    expect(ids(r.products)).toEqual(['7', '6', '5'])
    expect(r).toMatchObject({ page: 1, pageSize: 3, total: 7 })
  })

  it('returns a middle page with no top rated', async () => {
    const r = await page(ten, 'men', { page: 2, pageSize: 3 })
    expect(r.topRated).toEqual([])
    expect(ids(r.products)).toEqual(['4', '3', '2'])
  })

  it('returns a shorter last page and echoes the requested page size', async () => {
    const r = await page(ten, 'men', { page: 3, pageSize: 3 })
    expect(ids(r.products)).toEqual(['1'])
    expect(r).toMatchObject({ page: 3, pageSize: 3, total: 7 })
  })

  it('returns empty products and the real total when the page is past the end', async () => {
    const r = await page(ten, 'men', { page: 9, pageSize: 3 })
    expect(r.products).toEqual([])
    expect(r.total).toBe(7)
  })

  it('fits the remainder on one page when it equals the page size', async () => {
    const r = await page(ten, 'men', { page: 1, pageSize: 7 })
    expect(r.products).toHaveLength(7)
    expect((await page(ten, 'men', { page: 2, pageSize: 7 })).products).toEqual([])
  })

  it('returns empty top rated and products on page 2 for a category with three or fewer products', async () => {
    const r = await page([rated('1', 1), rated('2', 2)], 'men', { page: 2, pageSize: 12 })
    expect(r).toMatchObject({ topRated: [], products: [], total: 0 })
  })

  it('keeps tie order by id across pages', async () => {
    const tied = ['10', '2', '1', '4', '3', '5'].map((id) => rated(id, 4))
    const first = await page(tied, 'men', { page: 1, pageSize: 2 })
    const second = await page(tied, 'men', { page: 2, pageSize: 2 })
    expect([...ids(first.topRated), ...ids(first.products), ...ids(second.products)]).toEqual(['1', '2', '3', '4', '5', '10'])
  })

  it('never repeats a product between pages or with top rated', async () => {
    const seen = [...ids((await page(ten, 'men', { page: 1, pageSize: 2 })).topRated)]
    for (const n of [1, 2, 3, 4]) seen.push(...ids((await page(ten, 'men', { page: n, pageSize: 2 })).products))
    expect(new Set(seen).size).toBe(10)
    expect(seen).toHaveLength(10)
  })

  it('throws NotFoundError for an unknown category on page 2', async () => {
    await expect(page(ten, 'toys', { page: 2, pageSize: 3 })).rejects.toBeInstanceOf(NotFoundError)
  })
})

const item = (id: string, title: string, description?: string): Product => ({ id, title, description })
const search = async (products: Product[], term: string) =>
  (await createCatalogueService({ provider: fakeProductProvider(products), featuredIds: [] }).search(term, { page: 1, pageSize: 50 }))
    .products

describe('search', () => {
  it('matches the title', async () => {
    expect(ids(await search([item('1', 'Red shirt'), item('2', 'Blue hat')], 'shirt'))).toEqual(['1'])
  })

  it('matches the description', async () => {
    expect(ids(await search([item('1', 'Thing', 'Made of cotton'), item('2', 'Other', 'Wool')], 'cotton'))).toEqual(['1'])
  })

  it('ignores letter case in the term and the product', async () => {
    expect(ids(await search([item('1', 'Red SHIRT')], 'shIrT'))).toEqual(['1'])
  })

  it('returns an empty list when nothing matches', async () => {
    expect(await search([item('1', 'Red shirt')], 'zzz')).toEqual([])
  })

  it('treats regex characters literally', async () => {
    const products = [item('1', 'Shirt (blue)'), item('2', 'Hat')]
    expect(ids(await search(products, '('))).toEqual(['1'])
    expect(await search(products, '.*')).toEqual([])
  })

  it('keeps provider order', async () => {
    expect(ids(await search([item('3', 'a hat'), item('1', 'a hat'), item('2', 'a hat')], 'hat'))).toEqual(['3', '1', '2'])
  })

  it('does not fail on a product without a description', async () => {
    expect(ids(await search([item('1', 'Hat')], 'hat'))).toEqual(['1'])
  })

  it('propagates an upstream error', async () => {
    const svc = createCatalogueService({ provider: fakeProductProvider([], new UpstreamError('down')), featuredIds: [] })
    await expect(svc.search('x', { page: 1, pageSize: 12 })).rejects.toBeInstanceOf(UpstreamError)
  })
})

describe('search paging', () => {
  const hats = ['1', '2', '3', '4', '5'].map((id) => item(id, 'a hat'))
  const run = (paging: { page: number; pageSize: number }, list = hats) =>
    createCatalogueService({ provider: fakeProductProvider(list), featuredIds: [] }).search('hat', paging)

  it('returns the first page in provider order with the match count as total', async () => {
    const r = await run({ page: 1, pageSize: 2 })
    expect(ids(r.products)).toEqual(['1', '2'])
    expect(r).toMatchObject({ page: 1, pageSize: 2, total: 5 })
  })

  it('returns a middle page', async () => {
    expect(ids((await run({ page: 2, pageSize: 2 })).products)).toEqual(['3', '4'])
  })

  it('returns a shorter last page', async () => {
    expect(ids((await run({ page: 3, pageSize: 2 })).products)).toEqual(['5'])
  })

  it('returns empty products and the real total past the end', async () => {
    const r = await run({ page: 4, pageSize: 2 })
    expect(r).toMatchObject({ products: [], total: 5 })
  })

  it('returns everything on one page when the matches equal the page size', async () => {
    expect((await run({ page: 1, pageSize: 5 })).products).toHaveLength(5)
  })

  it('returns zero total and no products when nothing matches', async () => {
    expect(await run({ page: 1, pageSize: 12 }, [item('1', 'Shirt')])).toEqual({ products: [], page: 1, pageSize: 12, total: 0 })
  })
})

describe('listCategories', () => {
  it('passes through the provider categories', async () => {
    const provider = fakeProductProvider([rated('1', 1, 'men'), rated('2', 1, 'women')])
    expect(await createCatalogueService({ provider, featuredIds: [] }).listCategories()).toEqual(['men', 'women'])
  })
})

describe('default page size boundaries (12)', () => {
  const size = { page: 1, pageSize: 12 }
  const hats = (n: number) => Array.from({ length: n }, (_, i) => item(String(i + 1), 'a hat'))
  const search = (n: number, page: number) =>
    createCatalogueService({ provider: fakeProductProvider(hats(n)), featuredIds: [] }).search('hat', { ...size, page })
  // rating n for id n: ranking runs n..1, the top three are the highest ids, the remainder is n - 3
  const category = (n: number, p: number) =>
    page(Array.from({ length: n }, (_, i) => rated(String(i + 1), i + 1)), 'men', { ...size, page: p })

  it('search with exactly 12 matches fills page 1 and leaves page 2 empty', async () => {
    expect((await search(12, 1)).products).toHaveLength(12)
    expect(await search(12, 2)).toMatchObject({ products: [], total: 12 })
  })

  it('search with 13 matches puts the thirteenth on page 2', async () => {
    expect((await search(13, 1)).products).toHaveLength(12)
    expect(ids((await search(13, 2)).products)).toEqual(['13'])
  })

  it('category with 13 products shows 10 after the top three, all on page 1', async () => {
    const r = await category(13, 1)
    expect(r.topRated).toHaveLength(3)
    expect(r.products).toHaveLength(10)
    expect(r.total).toBe(10)
  })

  it('category with 15 products fits the remainder of 12 on one page', async () => {
    expect(await category(15, 2)).toMatchObject({ products: [], total: 12 })
  })

  it('category with 16 products spills the lowest ranked product to page 2', async () => {
    expect(ids((await category(16, 2)).products)).toEqual(['1'])
  })
})
