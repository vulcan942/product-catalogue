import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEnquiry } from '@/lib/api'
import { EnquiryForm } from './EnquiryForm'

// Response bodies are copied byte for byte from server/src/routes/enquiries.contract.test.ts.
// The form here uses the real sendEnquiry; only fetch is stubbed.

const product = { id: '7', title: 'Desk lamp', price: 19.5, category: 'lighting' }
const reply = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'application/json' } })

function stubFetch(body: string, status: number) {
  const fn = vi.fn(async () => reply(body, status))
  vi.stubGlobal('fetch', fn)
  return fn
}

async function fillAndSend() {
  await userEvent.type(screen.getByLabelText('Your name'), 'Jo')
  await userEvent.type(screen.getByLabelText('Email'), 'jo@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }))
}

function setup() {
  render(<EnquiryForm product={product} onSubmit={sendEnquiry} onDone={() => {}} onCancel={() => {}} />)
}

afterEach(() => vi.unstubAllGlobals())

describe('EnquiryForm with the real sendEnquiry and server-shaped responses', () => {
  it('posts to /api/enquiries with name, email, message and product and shows the thank-you on 201', async () => {
    const fn = stubFetch('{"status":"sent"}', 201)
    setup()
    await fillAndSend()
    expect(await screen.findByText('Thank you. We will reply by email.')).toBeInTheDocument()
    const calls = fn.mock.calls as unknown as Array<[string, RequestInit]>
    expect(calls[0]?.[0]).toBe('/api/enquiries')
    expect(JSON.parse(calls[0]?.[1].body as string)).toEqual({
      name: 'Jo',
      email: 'jo@example.com',
      message: 'I am interested in Desk lamp.',
      product: { id: '7', title: 'Desk lamp', price: 19.5 },
    })
  })

  it('shows each server field message beside its field on 400', async () => {
    stubFetch(
      '{"error":{"code":"validation_failed","message":"Check the highlighted fields.","fields":{"name":"Enter your name.","email":"Enter a valid email address.","phone":"Use digits, spaces and + - ( ) only.","message":"Enter a message.","product":"That product is not valid."}}}',
      400,
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setup()
    await fillAndSend()
    expect(await screen.findByLabelText(/Phone/)).toHaveAccessibleDescription('Use digits, spaces and + - ( ) only.')
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription('Enter your name.')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.')
    expect(screen.getByLabelText('Message')).toHaveAccessibleDescription('Enter a message.')
    expect(screen.queryByText('Thank you. We will reply by email.')).not.toBeInTheDocument()
  })

  it('shows the server rate-limit text in the failure alert on 429', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch('{"error":{"code":"rate_limited","message":"You have sent several enquiries. Try again in a few minutes."}}', 429)
    setup()
    await fillAndSend()
    expect(await screen.findByRole('alert')).toHaveTextContent('You have sent several enquiries. Try again in a few minutes.')
    expect(screen.queryByText('Thank you. We will reply by email.')).not.toBeInTheDocument()
  })

  it('shows the server text in the failure alert on 502 enquiry_not_sent and never the thank-you', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch('{"error":{"code":"enquiry_not_sent","message":"We could not send your enquiry. Try again in a moment."}}', 502)
    setup()
    await fillAndSend()
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not send your enquiry. Try again in a moment.')
    expect(screen.queryByText('Thank you. We will reply by email.')).not.toBeInTheDocument()
  })

  it('shows the server text in the failure alert on 413', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch('{"error":{"code":"payload_too_large","message":"That enquiry is too large. Shorten your message and try again."}}', 413)
    setup()
    await fillAndSend()
    expect(await screen.findByRole('alert')).toHaveTextContent('Shorten your message and try again.')
  })

  it('shows generic copy on a 502 upstream_unavailable and still no thank-you', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch('{"error":{"code":"upstream_unavailable","message":"Products are unavailable right now. Try again in a moment."}}', 502)
    setup()
    await fillAndSend()
    expect(await screen.findByRole('alert')).toHaveTextContent('Your enquiry was not sent.')
    expect(screen.queryByText('Thank you. We will reply by email.')).not.toBeInTheDocument()
  })
})
