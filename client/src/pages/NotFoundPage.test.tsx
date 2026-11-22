import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '@/routes'

describe('NotFoundPage', () => {
  it('shows a heading and a link back to the catalogue', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/nope'] })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { name: 'This page does not exist.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the catalogue' })).toHaveAttribute('href', '/')
  })
})
