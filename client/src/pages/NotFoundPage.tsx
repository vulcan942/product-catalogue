import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-2">
      <h2 className="text-xl leading-7 font-semibold">This page does not exist.</h2>
      <Link
        to="/"
        className="flex min-h-11 items-center underline hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Go to the catalogue
      </Link>
    </div>
  )
}
