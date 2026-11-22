import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatPrice } from '@/lib/format'
import type { Product } from '@/lib/product'

interface ProductCardProps {
  product: Product
  currency?: string
  onEnquire: (product: Product) => void
  renderTitle?: (product: Product) => ReactNode
}

export function ProductCard({ product, currency, onEnquire, renderTitle }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = product.image && !imageFailed

  return (
    <Card className="w-full gap-0 py-0 [--card-spacing:--spacing(4)] hover:shadow-raised">
      <div className="flex aspect-square items-center justify-center bg-muted p-6">
        {showImage ? (
          <img
            src={product.image}
            alt={product.title}
            onError={() => setImageFailed(true)}
            className="size-full object-contain"
          />
        ) : (
          <span className="text-sm text-muted-foreground">No image</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category && (
          <p className="text-xs leading-4 text-muted-foreground">{product.category}</p>
        )}
        <h3 className="text-base leading-6 font-semibold">
          {renderTitle ? renderTitle(product) : <span className="line-clamp-2">{product.title}</span>}
        </h3>
        {product.price !== undefined && (
          <p className="text-lg leading-6 font-semibold">{formatPrice(product.price, currency)}</p>
        )}
        <Button variant="secondary" className="mt-auto w-full" onClick={() => onEnquire(product)}>
          Enquire<span className="sr-only"> about {product.title}</span>
        </Button>
      </div>
    </Card>
  )
}
