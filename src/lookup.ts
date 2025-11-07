import type { LookupOptions } from './types'
import { BrregEnhetSchema } from './schema'
import { joinUrl, normalizeBase } from './constants'
import { getWithRetry } from './http'

export function parseOrgNumber(input: string): string {
  const digits = input.replace(/\s+/g, '')
  if (!/^\d{9}$/.test(digits)) {
    throw new Error('Organization number must contain exactly 9 digits.')
  }
  return digits
}

export async function lookupOrgNumber(orgNumber: string, options: LookupOptions = {}) {
  const id = parseOrgNumber(orgNumber)
  const base = normalizeBase(options.baseUrl)
  const url = joinUrl(base, `/enheter/${encodeURIComponent(id)}`)

  const res = await getWithRetry(url, options)
  const json = await res.json()

  const parsed = BrregEnhetSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')} - ${i.message}`).join('; ')
    throw new Error(`Invalid BRREG response: ${issues || 'unknown validation error'}`)
  }
  return parsed.data
}
