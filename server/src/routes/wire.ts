import type { Product } from '../domain/product.ts'

export interface WireProduct {
  id: string
  title: string
  price?: number
  image?: string
  category?: string
}

export interface WireProductDetail extends WireProduct {
  description?: string
}

// The one place that decides what a product card exposes: no rating, no description.
export function toCard({ id, title, price, image, category }: Product): WireProduct {
  return { id, title, price, image, category }
}

// Card fields plus description. Still no rating.
export function toDetail(product: Product): WireProductDetail {
  return { ...toCard(product), description: product.description }
}
