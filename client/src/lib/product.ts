// The only product shape components accept. The server maps any data source into it.
export interface Product {
  id: string | number
  title: string
  price?: number
  image?: string
  category?: string
}
