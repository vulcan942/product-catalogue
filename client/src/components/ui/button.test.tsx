import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('shows its label and reacts to a click', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Enquire</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Enquire' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
