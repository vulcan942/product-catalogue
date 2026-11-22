import { EnquiryError, type EnquiryFieldName, type SubmitEnquiry } from './enquiry'
import type { Product } from './product'

const BASE_URL = '/api'

export interface ProductDetail extends Product {
  description?: string
}

export interface ProductListPage {
  products: Product[]
  page: number
  pageSize: number
  total: number
}

export interface CategoryPage extends ProductListPage {
  topRated: Product[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string> }
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorBody = {}
  try {
    body = (await response.json()) as ErrorBody
  } catch {
    // Non-JSON error body (proxy page, empty 502): fall through to the generic message.
  }
  const { code, message, fields } = body.error ?? {}
  return new ApiError(
    response.status,
    code ?? 'unknown_error',
    message ?? 'Something went wrong. Try again.',
    fields,
  )
}

async function request<T>(path: string, params?: Record<string, string | number | undefined>, init?: RequestInit): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) query.set(key, String(value))
  }
  const qs = query.size > 0 ? `?${query}` : ''

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}${qs}`, init)
  } catch {
    throw new ApiError(0, 'network_error', 'We could not reach the server. Check your connection and try again.')
  }
  if (!response.ok) throw await toApiError(response)
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(response.status, 'bad_response', 'The server sent a reply we could not read. Try again in a moment.')
  }
}

const segment = encodeURIComponent

export const getFeatured = () => request<Product[]>('/products/featured')

export const getCategories = () => request<string[]>('/categories')

// Page 1 is the server default, so the param is only sent after it.
const pageParam = (page?: number) => (page !== undefined && page > 1 ? page : undefined)

export const getCategoryPage = (category: string, page?: number) =>
  request<CategoryPage>(`/categories/${segment(category)}/products`, { page: pageParam(page) })

export const searchProducts = (q: string, page?: number) =>
  request<ProductListPage>('/products', { q, page: pageParam(page) })

export const getProduct = (id: string | number) => request<ProductDetail>(`/products/${segment(String(id))}`)

const FIELD_NAMES: EnquiryFieldName[] = ['name', 'email', 'phone', 'message', 'product']

// Keeps only keys the form knows, with string values. Undefined when none remain.
function knownFields(raw: unknown): Partial<Record<EnquiryFieldName, string>> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const known: Partial<Record<EnquiryFieldName, string>> = {}
  for (const name of FIELD_NAMES) {
    const value = (raw as Record<string, unknown>)[name]
    if (typeof value === 'string') known[name] = value
  }
  return Object.keys(known).length > 0 ? known : undefined
}

// Resolves on 201. Rejects with EnquiryError when the server gave text the form can show
// (400 fields, 429, 413, enquiry_not_sent), otherwise with the original error.
export const sendEnquiry: SubmitEnquiry = async (payload) => {
  try {
    await request<{ status: 'sent' }>('/enquiries', undefined, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.status === 400) {
      const fields = knownFields(error.fields)
      // A product-only error has no input to mark, so its text goes in the alert.
      if (fields) throw new EnquiryError({ fields, message: fields.product })
    }
    if (error.status === 404) {
      throw new EnquiryError({ message: 'We could not find that product. Go back to the catalogue and try again.' })
    }
    if (error.status === 429 || error.status === 413 || error.code === 'enquiry_not_sent') {
      throw new EnquiryError({ message: error.message })
    }
    throw error
  }
}
