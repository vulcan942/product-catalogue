import { vi } from 'vitest'

// Tests may talk to localhost (our own app) but never to the real Fake Store API or a mail server.
const realFetch = globalThis.fetch
vi.stubGlobal('fetch', (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    return Promise.reject(new Error(`Network blocked in tests: ${url.origin}`))
  }
  return realFetch(input, init)
})
