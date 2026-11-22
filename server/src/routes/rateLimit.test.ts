import type { Request, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRateLimit, rateLimitKey } from './rateLimit.ts'

afterEach(() => vi.restoreAllMocks())

// Calls the limiter once; returns the status it wrote, or 'next' when the request passed.
function hit(limiter: ReturnType<typeof createRateLimit>, ip: string | undefined) {
  const headers: Record<string, string> = {}
  let status: number | 'next' = 'next'
  let body: unknown
  const res = {
    setHeader: (k: string, v: string) => (headers[k] = v),
    status(code: number) {
      status = code
      return this
    },
    json: (b: unknown) => (body = b),
  } as unknown as Response
  limiter({ ip } as Request, res, () => {})
  return { status, headers, body }
}

function setup() {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  let time = 1_000_000
  const limiter = createRateLimit({ limit: 5, windowMs: 600_000, now: () => time })
  return { limiter, advance: (ms: number) => (time += ms) }
}

describe('rate limiter', () => {
  it('lets the first five requests through', () => {
    const { limiter } = setup()
    const results = Array.from({ length: 5 }, () => hit(limiter, '1.1.1.1').status)
    expect(results).toEqual(Array(5).fill('next'))
  })

  it('answers 429 with the shared error body on the sixth request', () => {
    const { limiter } = setup()
    for (let i = 0; i < 5; i++) hit(limiter, '1.1.1.1')
    const sixth = hit(limiter, '1.1.1.1')
    expect(sixth.status).toBe(429)
    expect(sixth.body).toEqual({ error: { code: 'rate_limited', message: 'You have sent several enquiries. Try again in a few minutes.' } })
  })

  it('sets Retry-After to the seconds until the oldest hit expires, rounded up', () => {
    const { limiter, advance } = setup()
    for (let i = 0; i < 5; i++) hit(limiter, '1.1.1.1')
    advance(100_500)
    expect(hit(limiter, '1.1.1.1').headers['Retry-After']).toBe('500')
  })

  it('allows requests again after the window passes', () => {
    const { limiter, advance } = setup()
    for (let i = 0; i < 6; i++) hit(limiter, '1.1.1.1')
    advance(600_001)
    expect(hit(limiter, '1.1.1.1').status).toBe('next')
  })

  it('keeps a separate count per IP', () => {
    const { limiter } = setup()
    for (let i = 0; i < 6; i++) hit(limiter, '1.1.1.1')
    expect(hit(limiter, '2.2.2.2').status).toBe('next')
  })

  it('prunes idle clients once the window has passed', () => {
    const { limiter, advance } = setup()
    for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) hit(limiter, ip)
    advance(600_001)
    // Map has no size accessor from outside, so count the deletions the prune makes.
    const deleted = vi.spyOn(Map.prototype, 'delete')
    hit(limiter, '4.4.4.4')
    expect(deleted).toHaveBeenCalledTimes(3)
  })

  it('keeps limiting a busy client after the prune removes an idle one', () => {
    const { limiter, advance } = setup()
    hit(limiter, '2.2.2.2')
    advance(300_000)
    for (let i = 0; i < 5; i++) hit(limiter, '1.1.1.1')
    advance(300_001)
    expect(hit(limiter, '1.1.1.1').status).toBe(429)
  })

  it('treats a request with no IP as one shared unknown client', () => {
    const { limiter } = setup()
    for (let i = 0; i < 5; i++) hit(limiter, undefined)
    expect(hit(limiter, undefined).status).toBe(429)
  })

  it('does not rescan the clients on every request inside one window', () => {
    const { limiter, advance } = setup()
    hit(limiter, '1.1.1.1')
    advance(600_001)
    hit(limiter, '2.2.2.2')
    const deleted = vi.spyOn(Map.prototype, 'delete')
    advance(1_000)
    hit(limiter, '3.3.3.3')
    expect(deleted).not.toHaveBeenCalled()
  })

  it('shares one count for IPv6 addresses inside the same /64', () => {
    const { limiter } = setup()
    for (let i = 0; i < 5; i++) hit(limiter, `2001:db8:1:2:${i}::${i + 1}`)
    expect(hit(limiter, '2001:db8:1:2:ffff:ffff:ffff:ffff').status).toBe(429)
  })

  it('counts a different /64 separately', () => {
    const { limiter } = setup()
    for (let i = 0; i < 5; i++) hit(limiter, '2001:db8:1:2::1')
    expect(hit(limiter, '2001:db8:1:3::1').status).toBe('next')
  })

  it('treats an IPv4-mapped address as the IPv4 address', () => {
    const { limiter } = setup()
    for (let i = 0; i < 5; i++) hit(limiter, '::ffff:9.9.9.9')
    expect(hit(limiter, '9.9.9.9').status).toBe(429)
  })
})

describe('rateLimitKey', () => {
  it.each([
    ['1.2.3.4', '1.2.3.4'],
    ['::ffff:1.2.3.4', '1.2.3.4'],
    ['2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd', '2001:db8:1:2::/64'],
    ['2001:db8::5', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['2001:DB8:ABCD:1::5', '2001:db8:abcd:1::/64'],
    ['::', '0:0:0:0::/64'],
    ['1::', '1:0:0:0::/64'],
    ['1:2:3:4:5:6:7::', '1:2:3:4::/64'],
    ['2001:db8:0:1::5', '2001:db8:0:1::/64'],
    ['2001:DB8::1%eth0', '2001:db8:0:0::/64'],
    ['::ffff:1.2.3.4%eth0', '1.2.3.4'],
    ['::ffff:0102:0304', '1.2.3.4'],
    ['::FFFF:0102:0304', '1.2.3.4'],
    ['::ffff:0102:0304%eth0', '1.2.3.4'],
    ['garbage:::x', 'garbage:::x'],
    ['a:b', 'a:b'],
  ])('maps %s to %s', (ip, key) => {
    expect(rateLimitKey(ip)).toBe(key)
  })

  it('returns a 100000-character string unchanged without throwing', () => {
    const long = 'a:'.repeat(50_000)
    expect(rateLimitKey(long)).toBe(long)
  })
})
