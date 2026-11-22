import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from '@/components/SearchBar'
import { searchProducts } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  searchProducts: vi.fn(),
}))

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

const renderBar = () => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <SearchBar />
            <Where />
          </>
        ),
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

const field = () => screen.getByRole('searchbox', { name: 'Search products' })

describe('SearchBar', () => {
  it('goes to the results page with the trimmed, encoded term', async () => {
    renderBar()
    await userEvent.type(field(), '  men & shirt ')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/search?q=men%20%26%20shirt')
  })

  it('shows an inline error and stays put on an empty submit', async () => {
    renderBar()
    await userEvent.type(field(), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a word to search for.')
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAccessibleDescription('Enter a word to search for.')
    expect(field()).toHaveFocus()
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/)
    expect(searchProducts).not.toHaveBeenCalled()
  })

  it('clears the error when the user types', async () => {
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.type(field(), 'a')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(field()).not.toHaveAttribute('aria-invalid')
  })
})
