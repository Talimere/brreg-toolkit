import type { LookupOptions } from './types'
import { ACCEPT } from './constants'
import { retryWithBackoff } from './retry'
import { handleBrregError } from './errors'

export function resolveFetch(fetchFn?: LookupOptions['fetchFn']) {
  const fn = fetchFn ?? (globalThis as any).fetch
  if (!fn) throw new Error('No fetch implementation found. Use Node 18+/browser or pass fetchFn.')
  return fn
}

/** GET helper with shared headers + retry + standard BRREG error handling */
export async function getWithRetry(url: string, options: LookupOptions = {}): Promise<Response> {
  const fetchFn = resolveFetch(options.fetchFn)

  const doFetch = async () => {
    const r = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: ACCEPT, ...options.headers },
      signal: options.signal,
    })
    // Retry only on 5xx; let caller handle .ok below
    if (r.status >= 500) throw new Error(`Server error ${r.status}`)
    return r
  }

  const res = options.retry === false
    ? await doFetch()
    : await retryWithBackoff(doFetch, options.retry ?? {})

  if (!res.ok) {
    await handleBrregError(res) // throws
  }

  return res
}
