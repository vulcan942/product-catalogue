import { isIP } from 'node:net'
import type { RequestHandler } from 'express'

// IPv6 clients usually own a whole /64, so rotating inside it must not buy fresh quota.
// IPv4-mapped addresses (::ffff:a.b.c.d) count as the IPv4 address itself.
export function rateLimitKey(ip: string): string {
  const addr = ip.split('%')[0]!
  const version = isIP(addr)
  // Malformed input is returned as is: it can only share a bucket with the same string.
  if (version === 0) return ip
  if (version === 4) return addr

  const [head = '', tail] = addr.split('::')
  const toHextets = (part: string) => {
    const parts = part ? part.split(':') : []
    const last = parts[parts.length - 1]
    if (last?.includes('.')) {
      const [a = 0, b = 0, c = 0, d = 0] = last.split('.').map(Number)
      parts.splice(-1, 1, ((a << 8) | b).toString(16), ((c << 8) | d).toString(16))
    }
    return parts.map((h) => parseInt(h, 16))
  }
  const headParts = toHextets(head)
  const tailParts = toHextets(tail ?? '')
  const zeros = Array<number>(Math.max(0, 8 - headParts.length - tailParts.length)).fill(0)
  const h = [...headParts, ...zeros, ...tailParts]

  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) {
    return `${h[6]! >> 8}.${h[6]! & 255}.${h[7]! >> 8}.${h[7]! & 255}`
  }
  return h.slice(0, 4).map((x) => x.toString(16)).join(':') + '::/64'
}

// Sliding window per client, kept in this instance's memory.
// ponytail: per process and lost on restart; use a shared store if the server scales out.
export function createRateLimit(options: { limit: number; windowMs: number; now?: () => number }): RequestHandler {
  const { limit, windowMs, now = Date.now } = options
  const hits = new Map<string, number[]>()
  let lastPrune = now()

  return (req, res, next) => {
    const time = now()
    // Drop idle keys at most once per window so the map stays bounded without an O(n) scan per request.
    if (time - lastPrune >= windowMs) {
      lastPrune = time
      for (const [k, stamps] of hits) {
        if (stamps.every((t) => t <= time - windowMs)) hits.delete(k)
      }
    }

    const key = rateLimitKey(req.ip ?? 'unknown')
    const times = (hits.get(key) ?? []).filter((t) => t > time - windowMs)
    if (times.length >= limit) {
      const retryAfter = Math.ceil((times[0]! + windowMs - time) / 1000)
      console.warn(`enquiry rate limited ip=${key}`)
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({ error: { code: 'rate_limited', message: 'You have sent several enquiries. Try again in a few minutes.' } })
      return
    }
    times.push(time)
    hits.set(key, times)
    next()
  }
}
