import { AlertCircle, CircleCheck } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EnquiryError, type EnquiryPayload, type SubmitEnquiry } from '@/lib/enquiry'
import { formatPrice } from '@/lib/format'
import type { Product } from '@/lib/product'

interface EnquiryFormProps {
  product?: Product
  currency?: string
  onSubmit: SubmitEnquiry
  onDone: () => void
  onCancel: () => void
}

type Status = 'idle' | 'sending' | 'success' | 'error'
type Field = 'name' | 'email' | 'phone' | 'message'
type Errors = Partial<Record<Field, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD_ORDER: Field[] = ['name', 'email', 'phone', 'message']
const GENERIC_FAILURE = 'Your enquiry was not sent. Check your connection and try again.'

function validate(name: string, email: string, message: string): Errors {
  const errors: Errors = {}
  if (!name.trim()) errors.name = 'Enter your name.'
  if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address.'
  if (!message.trim()) errors.message = 'Enter a message.'
  return errors
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="flex items-center gap-1 text-sm leading-5 text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

export function EnquiryForm({ product, currency, onSubmit, onDone, onCancel }: EnquiryFormProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<Errors>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const doneRef = useRef<HTMLButtonElement>(null)
  // A ref, not state: two submits in the same tick both see the old state.
  const sendingRef = useRef(false)
  const [failure, setFailure] = useState(GENERIC_FAILURE)

  // The focused button was disabled or removed, so focus has to be placed again.
  useEffect(() => {
    if (status === 'error') submitRef.current?.focus()
    if (status === 'success') doneRef.current?.focus()
  }, [status])

  function focusFirst(found: Errors) {
    const first = FIELD_ORDER.find((f) => found[f])
    if (first) ({ name: nameRef, email: emailRef, phone: phoneRef, message: messageRef })[first].current?.focus()
    return !!first
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (key: string) => String(data.get(key) ?? '')
    const name = text('name')
    const email = text('email')
    const message = text('message')

    if (sendingRef.current) return

    const found = validate(name, email, message)
    setErrors(found)
    if (focusFirst(found)) {
      setStatus('idle')
      return
    }

    const phone = text('phone').trim()
    const website = text('website')
    const payload: EnquiryPayload = {
      name: name.trim(),
      email: email.trim(),
      ...(phone && { phone }),
      message: message.trim(),
      ...(product && { product: { id: product.id, title: product.title, price: product.price } }),
      ...(website && { website }),
    }

    sendingRef.current = true
    setStatus('sending')
    try {
      await onSubmit(payload)
      setStatus('success')
    } catch (error) {
      const fields = error instanceof EnquiryError ? error.fields : undefined
      const shown: Errors = {}
      for (const f of FIELD_ORDER) if (fields?.[f]) shown[f] = fields[f]
      setErrors(shown)
      setFailure(error instanceof EnquiryError && error.message ? error.message : GENERIC_FAILURE)
      if (Object.keys(shown).length > 0) {
        setStatus('idle')
        focusFirst(shown)
      } else {
        setStatus('error')
      }
    } finally {
      sendingRef.current = false
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">
          <CircleCheck />
          <AlertTitle>Enquiry sent</AlertTitle>
          <AlertDescription id="enquiry-sent-text">Thank you. We will reply by email.</AlertDescription>
        </Alert>
        <Button ref={doneRef} onClick={onDone} aria-describedby="enquiry-sent-text">Back to products</Button>
      </div>
    )
  }

  const sending = status === 'sending'

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={sending} className="relative flex flex-col gap-4">
      {product && (
        <div className="rounded-md bg-muted p-4">
          <p className="text-sm leading-5 font-semibold wrap-anywhere">{product.title}</p>
          {product.category && <p className="text-xs leading-4 text-muted-foreground">
              <span className="first-letter:uppercase">{product.category}</span>
            </p>}
          {product.price !== undefined && (
            <p className="text-lg leading-6 font-semibold">{formatPrice(product.price, currency)}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="enquiry-name">Your name</Label>
        <Input
          id="enquiry-name"
          name="name"
          ref={nameRef}
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'enquiry-name-error' : undefined}
        />
        <FieldError id="enquiry-name-error" message={errors.name} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="enquiry-email">Email</Label>
        <Input
          id="enquiry-email"
          name="email"
          type="email"
          ref={emailRef}
          autoComplete="email"
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'enquiry-email-error' : undefined}
        />
        <FieldError id="enquiry-email-error" message={errors.email} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="enquiry-phone">
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="enquiry-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          ref={phoneRef}
          autoComplete="tel"
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'enquiry-phone-error' : undefined}
        />
        <FieldError id="enquiry-phone-error" message={errors.phone} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="enquiry-message">Message</Label>
        <Textarea
          id="enquiry-message"
          name="message"
          ref={messageRef}
          aria-required="true"
          defaultValue={product ? `I am interested in ${product.title}.` : ''}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? 'enquiry-message-error' : undefined}
        />
        <FieldError id="enquiry-message-error" message={errors.message} />
      </div>

      {/* Honeypot: hidden from people and assistive tech, bots fill it. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Enquiry not sent</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 min-[600px]:flex-row min-[600px]:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={sending}>
          Cancel
        </Button>
        <Button type="submit" ref={submitRef} disabled={sending}>
          {sending ? 'Sending…' : 'Send enquiry'}
        </Button>
      </div>
    </form>
  )
}
