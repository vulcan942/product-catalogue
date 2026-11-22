import type { Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, UpstreamError, ValidationError } from '../domain/errors.ts'
import { errorHandler } from './errorHandler.ts'

function handle(err: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
  errorHandler(err, { method: 'POST', path: '/api/enquiries' } as Request, res as unknown as Response, vi.fn())
  return res
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('errorHandler logging', () => {
  it('logs a validation failure as one warn with field names only and no error', () => {
    const res = handle(new ValidationError({ name: 'Jo Smith is wrong', email: 'jo@example.com is invalid' }))
    expect(res.status).toHaveBeenCalledWith(400)
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledTimes(1)
    const text = String(vi.mocked(console.warn).mock.calls[0]![0])
    expect(text).toContain('fields=name,email')
    expect(text).not.toContain('Jo Smith')
    expect(text).not.toContain('jo@example.com')
  })

  it('logs a not found as one warn and no error', () => {
    const res = handle(new NotFoundError('product 9'))
    expect(res.status).toHaveBeenCalledWith(404)
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(console.warn).mock.calls[0]![0])).toContain('status=404')
  })

  it('still logs an upstream failure with console.error and the error', () => {
    const err = new UpstreamError('down')
    handle(err)
    expect(console.error).toHaveBeenCalledWith(expect.any(String), err)
  })

  it('still logs an unexpected error with console.error and the error', () => {
    const err = new Error('boom')
    const res = handle(err)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(console.error).toHaveBeenCalledWith(expect.any(String), err)
  })
})
