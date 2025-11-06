import type { RetryOptions } from './retry'
export type { BrregEnhet } from './schema'

export interface LookupOptions {
  baseUrl?: string
  fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  headers?: Record<string, string>
  signal?: AbortSignal
  retry?: RetryOptions | false
}
