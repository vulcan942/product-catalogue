// Lenient: anything but a digit string of at least 1 means page 1, so a bad URL still shows results.
export function parsePage(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1
  const n = Number(raw)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}
