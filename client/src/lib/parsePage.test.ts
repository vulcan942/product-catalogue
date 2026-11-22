import { describe, expect, it } from 'vitest'
import { parsePage } from './parsePage'

describe('parsePage', () => {
  it.each([
    ['2', 2],
    ['007', 7],
    ['', 1],
    ['2.5', 1],
    ['0', 1],
    ['-1', 1],
    ['abc', 1],
    ['99999999999999999999', 1],
    [null, 1],
  ])('reads %j as page %i', (raw, expected) => {
    expect(parsePage(raw)).toBe(expected)
  })
})
