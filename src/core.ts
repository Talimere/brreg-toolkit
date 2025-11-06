import type { LookupOptions } from './types'
import { BrregEnhetSchema } from './schema'
import { retryWithBackoff } from './retry'
import { handleBrregError } from './errors'

const DEFAULT_BASE = 'https://data.brreg.no/enhetsregisteret/api'
const ACCEPT = 'application/vnd.brreg.enhetsregisteret.enhet.v2+json;charset=UTF-8'

export function parseOrgNumber(input: string): string {
  const digits = input.replace(/\s+/g, '')
  if (!/^\d{9}$/.test(digits)) {
    throw new Error('Organization number must contain exactly 9 digits.')
  }
  return digits
}

export async function lookupOrgNumber(
  orgNumber: string,
  options: LookupOptions = {},
) {
  const id = parseOrgNumber(orgNumber)
  const base = (options.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '')
  const url = `${base}/enheter/${encodeURIComponent(id)}`
  const fetchFn = options.fetchFn ?? (globalThis as any).fetch
  if (!fetchFn) throw new Error('No fetch implementation found. Use Node 18+/browser or pass fetchFn.')

  const doFetch = async () => {
    const r = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: ACCEPT, ...options.headers },
      signal: options.signal,
    })
    if (r.status >= 500) throw new Error(`Server error ${r.status}`)
    return r
  }

  const res = options.retry === false
    ? await doFetch()
    : await retryWithBackoff(doFetch, options.retry ?? {})

  if (!res.ok) {
    await handleBrregError(res)
  }

  const json = await res.json()
  const parsed = BrregEnhetSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')} - ${i.message}`).join('; ')
    throw new Error(`Invalid BRREG response: ${issues || 'unknown validation error'}`)
  }
  return parsed.data
}
