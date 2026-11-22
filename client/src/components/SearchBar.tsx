import { useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SearchBarProps {
  defaultValue?: string
  className?: string
}

// Navigates only; the results page fetches. An empty term never leaves the bar.
export function SearchBar({ defaultValue = '', className }: SearchBarProps) {
  const navigate = useNavigate()
  const id = useId()
  const errorId = `${id}-error`
  const inputRef = useRef<HTMLInputElement>(null)
  const [showError, setShowError] = useState(false)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const term = (inputRef.current?.value ?? '').trim()
    if (!term) {
      setShowError(true)
      inputRef.current?.focus()
      return
    }
    setShowError(false)
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  return (
    <form role="search" noValidate onSubmit={onSubmit} className={className}>
      <div className="flex gap-2">
        <Label htmlFor={id} className="sr-only">
          Search products
        </Label>
        <Input
          ref={inputRef}
          id={id}
          type="search"
          name="q"
          placeholder="Search products"
          maxLength={100}
          defaultValue={defaultValue}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          onChange={() => setShowError(false)}
          className="min-[960px]:w-(--card-min)"
        />
        <Button type="submit">
          Search
        </Button>
      </div>
      {showError && (
        <p id={errorId} role="alert" className="mt-2 flex items-center gap-2 text-sm leading-5 text-destructive">
          <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
          Enter a word to search for.
        </p>
      )}
    </form>
  )
}
