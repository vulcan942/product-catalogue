import { z } from 'zod'

// Word characters and hyphen only: the Fake Store adapter puts the id in a URL path, so ".", ".." and "/" must never reach it.
export const idSchema = z.string().regex(/^[\w-]+$/).max(64)

// Strict digit strings, not z.coerce.number(): coercion accepts "1e1", "0x10", "1.0" and one-element arrays.
const digitParam = (min: number, max: number, fallback: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max)).default(fallback)

// Keeps (page - 1) * pageSize exact in a double.
const MAX_PAGE = 1_000_000

const pagingSchema = z.object({ page: digitParam(1, MAX_PAGE, 1), pageSize: digitParam(1, 50, 12) })

const pagingMessages = { page: 'Use a whole number from 1 to 1000000.', pageSize: 'Use a whole number from 1 to 50.' }

// Returns field messages instead of throwing so search can merge them with its own q error into one 400.
export function parsePaging(query: Record<string, unknown>) {
  const result = pagingSchema.safeParse({ page: query.page, pageSize: query.pageSize })
  if (result.success) return { paging: result.data, fields: {} as Record<string, string> }
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof typeof pagingMessages
    fields[key] = pagingMessages[key]
  }
  return { paging: null, fields }
}
