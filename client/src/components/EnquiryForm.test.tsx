import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EnquiryError, type EnquiryPayload } from '@/lib/enquiry'
import { EnquiryForm } from './EnquiryForm'

const product = { id: '7', title: 'Solid Drive', price: 109, category: 'electronics' }

function setup(onSubmit: (p: EnquiryPayload) => Promise<void>) {
  render(<EnquiryForm product={product} onSubmit={onSubmit} onDone={() => {}} onCancel={() => {}} />)
}

async function fillAndSend() {
  await userEvent.type(screen.getByLabelText('Your name'), 'Ada')
  await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }))
}

describe('EnquiryForm', () => {
  it('shows errors beside the fields and focuses the first invalid one', async () => {
    const onSubmit = vi.fn()
    setup(onSubmit)
    await userEvent.type(screen.getByLabelText('Email'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }))
    expect(screen.getByLabelText('Your name')).toHaveFocus()
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription('Enter your name.')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows server field errors next to the right fields and focuses the first', async () => {
    setup(() =>
      Promise.reject(
        new EnquiryError({ fields: { phone: 'Use digits, spaces and + - ( ) only.', message: 'Use 2000 characters or fewer.' } }),
      ),
    )
    await fillAndSend()
    const phone = await screen.findByLabelText(/Phone/)
    expect(phone).toHaveAccessibleDescription('Use digits, spaces and + - ( ) only.')
    expect(screen.getByLabelText('Message')).toHaveAccessibleDescription('Use 2000 characters or fewer.')
    expect(phone).toHaveFocus()
    expect(screen.queryByText('Enquiry not sent')).not.toBeInTheDocument()
  })

  it('shows the failure alert when the server only flags a field the form does not show', async () => {
    setup(() => Promise.reject(new EnquiryError({ fields: { product: 'Unknown product.' } })))
    await fillAndSend()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Enquiry not sent')
    expect(alert).toHaveTextContent('Your enquiry was not sent. Check your connection and try again.')
  })

  it('clears the failure alert and shows inline errors when an invalid resubmit follows a failed send', async () => {
    setup(() => Promise.reject(new Error('down')))
    await fillAndSend()
    expect(await screen.findByRole('alert')).toHaveTextContent('Enquiry not sent')
    await userEvent.clear(screen.getByLabelText('Your name'))
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const name = screen.getByLabelText('Your name')
    expect(name).toHaveAccessibleDescription('Enter your name.')
    expect(name).toHaveFocus()
  })

  it('shows the server message in the alert for a rate limit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setup(() => Promise.reject(new EnquiryError({ message: 'You have sent several enquiries. Try again in a few minutes.' })))
    await fillAndSend()
    expect(await screen.findByRole('alert')).toHaveTextContent('You have sent several enquiries. Try again in a few minutes.')
  })

  it('shows generic copy and refocuses Send enquiry after an unexpected failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setup(() => Promise.reject(new Error('boom')))
    await fillAndSend()
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection and try again.')
    expect(screen.getByRole('button', { name: 'Send enquiry' })).toHaveFocus()
  })

  it('shows the thank-you and focuses Back to products on success', async () => {
    setup(() => Promise.resolve())
    await fillAndSend()
    expect(await screen.findByText('Thank you. We will reply by email.')).toBeInTheDocument()
    const back = screen.getByRole('button', { name: 'Back to products' })
    expect(back).toHaveFocus()
    expect(back).toHaveAccessibleDescription('Thank you. We will reply by email.')
  })

  it('sends once when submitted twice while sending', async () => {
    let resolve: () => void = () => {}
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    setup(onSubmit)
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada{Enter}{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    resolve()
    expect(await screen.findByText('Enquiry sent')).toBeInTheDocument()
  })

  it('keeps the honeypot out of the tab order and sends its value as website', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    setup(onSubmit)
    await userEvent.click(screen.getByLabelText('Message'))
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await userEvent.type(screen.getByLabelText('Your name'), 'Bot')
    await userEvent.type(screen.getByLabelText('Email'), 'bot@example.com')
    await userEvent.type(screen.getByLabelText('Website'), 'http://spam.example')
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ website: 'http://spam.example' }))
  })
})
