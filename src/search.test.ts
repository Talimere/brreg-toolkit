import { describe, it, expect, vi } from 'vitest'
import { searchEnheter } from './search'
import type { LookupOptions } from './types'

const noWait = async () => { } // instant backoff in tests
const instantRetry = { retries: 3, baseDelayMs: 0, backoffFactor: 1, sleepFn: noWait }

function json(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

const okBody = {
  _links: {
    self: { href: 'https://data.brreg.no/enhetsregisteret/api/enheter?page=0&size=20' },
    first: { href: 'https://data.brreg.no/enhetsregisteret/api/enheter?page=0&size=20' },
    next: { href: 'https://data.brreg.no/enhetsregisteret/api/enheter?page=1&size=20' },
    last: { href: 'https://data.brreg.no/enhetsregisteret/api/enheter?page=3&size=20' },
  },
  _embedded: {
    enheter: [
      { organisasjonsnummer: '509100675', navn: 'Sesam stasjon', _links: { self: { href: '' } } },
      { organisasjonsnummer: '999999999', navn: 'Acme AS', _links: { self: { href: '' } } },
    ],
  },
  page: { number: 0, size: 20, totalPages: 4, totalElements: 80 },
}

describe('searchEnheter – URL & params', () => {
  it('builds URL with navn/page/size and single sort', async () => {
    let capturedUrl = ''
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return json(okBody)
    })

    await searchEnheter(
      { navn: 'Sesam & co', page: 2, size: 5, sort: 'antallAnsatte,DESC' },
      { fetchFn: mockFetch as any, retry: instantRetry },
    )

    const url = new URL(capturedUrl)
    expect(url.origin + url.pathname).toBe('https://data.brreg.no/enhetsregisteret/api/enheter')
    expect(url.searchParams.get('navn')).toBe('Sesam & co')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('size')).toBe('5')
    expect(url.searchParams.get('sort')).toBe('antallAnsatte,DESC')
  })

  it('appends multiple sort parameters preserving order', async () => {
    let capturedUrl = ''
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return json(okBody)
    })

    await searchEnheter(
      { sort: [{ field: 'navn', direction: 'ASC' }, 'organisasjonsnummer,DESC'] },
      { fetchFn: mockFetch as any, retry: instantRetry },
    )

    const url = new URL(capturedUrl)
    const sorts = url.searchParams.getAll('sort')
    expect(sorts).toEqual(['navn,ASC', 'organisasjonsnummer,DESC'])
  })

  it('trims trailing slash in baseUrl', async () => {
    let capturedUrl = ''
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return json(okBody)
    })

    await searchEnheter({}, { baseUrl: 'https://data.brreg.no/enhetsregisteret/api/', fetchFn: mockFetch as any, retry: instantRetry })
    expect(capturedUrl).toBe('https://data.brreg.no/enhetsregisteret/api/enheter')
  })
})

describe('searchEnheter – results & pagination', () => {
  it('returns items, page and links from response', async () => {
    const mockFetch = vi.fn(async () => json(okBody))
    const res = await searchEnheter({}, { fetchFn: mockFetch as any, retry: instantRetry })

    expect(res.items.length).toBe(2)
    expect(res.items[0].organisasjonsnummer).toBe('509100675')
    expect(res.page).toEqual({ number: 0, size: 20, totalPages: 4, totalElements: 80 })
    expect(res.links.next).toMatch(/page=1/)
  })

  it('fills sensible defaults when _embedded/page/links missing', async () => {
    const body = {}
    const mockFetch = vi.fn(async () => json(body))
    const res = await searchEnheter({}, { fetchFn: mockFetch as any, retry: instantRetry })

    expect(res.items).toEqual([])
    expect(res.page.number).toBe(0)
    expect(res.page.size).toBe(0)
    expect(res.page.totalPages).toBe(1)
    expect(res.page.totalElements).toBe(0)
    expect(res.links.self).toBeUndefined()
  })
})

describe('searchEnheter – sorting validation', () => {
  it('throws for invalid sort field', async () => {
    await expect(
      searchEnheter({ sort: 'notAField,ASC' as any }, { fetchFn: vi.fn() as any, retry: false }),
    ).rejects.toThrow(/Invalid sort field/i)
  })

  it('throws for invalid sort direction', async () => {
    await expect(
      searchEnheter({ sort: { field: 'navn', direction: 'UP' as any } }, { fetchFn: vi.fn() as any, retry: false }),
    ).rejects.toThrow(/Invalid sort direction/i)
  })
})

describe('searchEnheter – retries & errors', () => {
  it('retries on 500 then succeeds', async () => {
    let calls = 0
    const mockFetch = vi.fn(async () => {
      calls++
      if (calls < 2) return new Response('boom', { status: 500 })
      return json(okBody)
    })

    const res = await searchEnheter({}, { fetchFn: mockFetch as any, retry: { ...instantRetry, retries: 3 } })
    expect(res.items.length).toBe(2)
    expect(calls).toBe(2)
  })

  it('does not retry on 400 and throws structured error', async () => {
    const mockFetch = vi.fn(async () => json({ feilmelding: 'Bad query' }, 400))
    await expect(searchEnheter({}, { fetchFn: mockFetch as any, retry: instantRetry })).rejects.toThrow(/Bad query|validation/i)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('fails after exceeding retries on 500', async () => {
    let calls = 0
    const mockFetch = vi.fn(async () => {
      calls++
      return new Response('nope', { status: 500 })
    })

    await expect(
      searchEnheter({}, { fetchFn: mockFetch as any, retry: { ...instantRetry, retries: 1 } }),
    ).rejects.toThrow(/Server error 500/i)
    expect(calls).toBe(2)
  })

  it('throws for invalid JSON body (200 but not JSON)', async () => {
    const mockFetch = vi.fn(async () => new Response('<html>oops</html>', { status: 200 }))
    await expect(searchEnheter({}, { fetchFn: mockFetch as any, retry: instantRetry })).rejects.toThrow()
  })
})

describe('searchEnheter – headers & fetch presence', () => {
  it('sends Accept header and merges custom headers', async () => {
    let capturedHeaders: HeadersInit | undefined
    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers
      return json(okBody)
    })

    await searchEnheter({}, { fetchFn: mockFetch as any, headers: { 'X-Custom': 'yes' }, retry: instantRetry })

    const out: Record<string, string> = {}
    if (capturedHeaders instanceof Headers) {
      capturedHeaders.forEach((v, k) => (out[k.toLowerCase()] = v))
    } else if (capturedHeaders && typeof capturedHeaders === 'object') {
      Object.entries(capturedHeaders as Record<string, string>).forEach(([k, v]) => (out[k.toLowerCase()] = v))
    }

    expect(out['accept']).toMatch(/application\/vnd\.brreg\.enhetsregisteret\.enhet\.v2\+json/i)
    expect(out['x-custom']).toBe('yes')
  })

  it('throws when no fetch implementation is available', async () => {
    const originalFetch = (globalThis as any).fetch
      ; (globalThis as any).fetch = undefined
    await expect(searchEnheter()).rejects.toThrow(/No fetch implementation found/i)
      ; (globalThis as any).fetch = originalFetch
  })
})

describe('searchEnheter – abort and retry toggling', () => {
  it('propagates abort via signal', async () => {
    const ac = new AbortController()
    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new Error('aborted')
      ac.abort()
      if (init?.signal?.aborted) throw new Error('aborted')
      return json(okBody)
    })

    await expect(searchEnheter({}, { fetchFn: mockFetch as any, signal: ac.signal, retry: instantRetry })).rejects.toThrow(/aborted/i)
  })

  it('does not retry when retry=false', async () => {
    const mockFetch = vi.fn(async () => {
      throw new Error('Network down')
    })
    await expect(searchEnheter({}, { fetchFn: mockFetch as any, retry: false })).rejects.toThrow(/Network down/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('searchEnheter – schema passthrough & edge cases', () => {
  it('keeps unknown top-level fields due to catchall', async () => {
    const body = { ...okBody, someNewRootField: { nested: true } }
    const mockFetch = vi.fn(async () => json(body))
    const res = await searchEnheter({}, { fetchFn: mockFetch as any, retry: instantRetry })
    // @ts-expect-error unknown passthrough retained in raw
    expect(res.raw.someNewRootField?.nested).toBe(true)
  })

  it('handles empty _embedded.enheter gracefully', async () => {
    const body = { ...okBody, _embedded: { enheter: [] } }
    const mockFetch = vi.fn(async () => json(body))
    const res = await searchEnheter({}, { fetchFn: mockFetch as any, retry: instantRetry })
    expect(res.items).toEqual([])
    expect(res.page.totalElements).toBe(80)
  })
})
