import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertCircle } from 'lucide-react'
import { EnquiryForm } from '@/components/EnquiryForm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ApiError, getProduct, sendEnquiry, type ProductDetail } from '@/lib/api'
import { formatPrice } from '@/lib/format'

type State =
  | { status: 'loading' | 'error' | 'not-found' }
  | { status: 'ready'; product: ProductDetail }

const linkClass =
  'flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
const columns =
  'grid grid-cols-1 gap-6 min-[600px]:grid-cols-[minmax(var(--card-min),1fr)_minmax(0,1fr)] min-[600px]:items-start min-[960px]:gap-12'
const well = 'flex aspect-square items-center justify-center rounded-lg bg-muted p-6'

// A 400 on the id means it failed validation; the person cannot tell that from an unknown product.
const isNotFound = (err: unknown) =>
  err instanceof ApiError && (err.status === 404 || (err.status === 400 && !!err.fields?.id))

// Keyed by id so navigating between products resets to loading without setState in the effect.
export function ProductPage() {
  const { id = '' } = useParams()
  return <ProductContent key={id} id={id} />
}

function ProductContent({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getProduct(id).then(
      (product) => !cancelled && setState({ status: 'ready', product }),
      (err: unknown) => !cancelled && setState({ status: isNotFound(err) ? 'not-found' : 'error' }),
    )
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const title =
    state.status === 'ready'
      ? `${state.product.title} - Catalogue`
      : state.status === 'not-found'
        ? 'Product not found - Catalogue'
        : 'Catalogue'
  useEffect(() => {
    document.title = title
    return () => {
      document.title = 'Catalogue'
    }
  }, [title])

  if (state.status === 'ready') return <ProductDetailView product={state.product} />

  if (state.status === 'loading') {
    return (
      <div role="status" aria-busy="true" aria-label="Loading product" className="flex flex-col gap-4">
        <div className="h-11" />
        <div className={columns}>
          <div className="aspect-square rounded-lg bg-muted" />
          <div className="flex flex-col gap-4">
            <div className="h-9 w-3/4 rounded-sm bg-muted" />
            <div className="h-6 w-1/4 rounded-sm bg-muted" />
            <div className="h-5 w-full rounded-sm bg-muted" />
            <div className="h-5 w-2/3 rounded-sm bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>Product did not load</AlertTitle>
          <AlertDescription>Check your connection and try again.</AlertDescription>
        </Alert>
        <Button
          variant="secondary"
          onClick={() => {
            setState({ status: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-heading-lg font-bold">We could not find that product.</h1>
      <p>It may have been removed. Browse the catalogue to find something else.</p>
      <Link to="/" className={`${linkClass} underline hover:text-primary`}>
        Go to the catalogue
      </Link>
    </div>
  )
}

function ProductDetailView({ product }: { product: ProductDetail }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = product.image && !imageFailed

  return (
    <div className="flex flex-col gap-4 min-[960px]:gap-6">
      <Link to="/" className={`${linkClass} w-fit text-sm font-semibold text-primary hover:underline`}>
        Back to products
      </Link>
      <div className={columns}>
        <div className={well}>
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
        <div className="flex flex-col items-stretch gap-4 min-[600px]:items-start">
          <div className="flex flex-col gap-2">
            {product.category && (
              <Link
                to={`/categories/${encodeURIComponent(product.category)}`}
                className={`${linkClass} w-fit text-xs leading-4 text-primary hover:underline`}
              >
                <span className="first-letter:uppercase">{product.category}</span>
              </Link>
            )}
            <h1 className="text-heading-lg font-bold wrap-anywhere">{product.title}</h1>
          </div>
          {product.price !== undefined && (
            <p className="text-lg leading-6 font-semibold">{formatPrice(product.price)}</p>
          )}
          {product.description && <p className="text-base leading-6 wrap-anywhere">{product.description}</p>}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="mt-2 w-full min-[600px]:w-auto">Enquire</Button>
            </DialogTrigger>
            {/* The form describes itself, so there is no separate dialog description. */}
            <DialogContent aria-describedby={undefined}>
              <DialogHeader className="pr-12">
                <DialogTitle className="wrap-anywhere">Enquire about {product.title}</DialogTitle>
              </DialogHeader>
              <EnquiryForm
                product={product}
                onSubmit={sendEnquiry}
                onCancel={() => setOpen(false)}
                onDone={() => navigate('/')}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
