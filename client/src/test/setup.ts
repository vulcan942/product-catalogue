import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

// Tests must never reach the network; fail loudly if component code tries.
vi.stubGlobal('fetch', (input: Parameters<typeof fetch>[0]) => {
  throw new Error(`Network blocked in tests: ${String(input)}`)
})
