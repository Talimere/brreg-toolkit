import { describe, it, expect, vi } from 'vitest'
import { lookupOrgNumber, parseOrgNumber } from './core'
import type { LookupOptions } from './types'

const noWait = async () => {}
const instantRetry = { retries: 3, baseDelayMs: 0, backoffFactor: 1, sleepFn: noWait }

function json(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('parseOrgNumber', () => {
  it('removes spaces and accepts exactly 9 digits', () => {
    expect(parseOrgNumber('509 100 675')).toBe('509100675')
  })

  it('rejects when not 9 digits', () => {
    expect(() => parseOrgNumber('12345678')).toThrow(/exactly 9 digits/i)
    expect(() => parseOrgNumber('1234567890')).toThrow(/exactly 9 digits/i)
  })

  it('rejects non-digit characters', () => {
    expect(() => parseOrgNumber('12a456789')).toThrow(/exactly 9 digits/i)
    expect(() => parseOrgNumber('509-100-675')).toThrow(/exactly 9 digits/i)
  })
})

describe('lookupOrgNumber – success & schema validation', () => {
  it('returns parsed JSON on 200 and passes schema', async () => {
    const mockFetch = vi.fn(async () =>
      json({
        organisasjonsnummer: '509100675',
        navn: 'Sesam stasjon',
        _links: { self: { href: 'https://data.brreg.no/enhetsregisteret/api/enheter/509100675' } },
      }),
    )

    const res = await lookupOrgNumber('509 100 675', { fetchFn: mockFetch as any, retry: instantRetry })
    expect(res.organisasjonsnummer).toBe('509100675')
    expect(res.navn).toBe('Sesam stasjon')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('throws when body is invalid according to schema (e.g., bad organisasjonsnummer)', async () => {
    const mockFetch = vi.fn(async () =>
      json({
        organisasjonsnummer: 'not-nine-digits',
        navn: 'Bad Corp',
      }),
    )
    await expect(
      lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: instantRetry }),
    ).rejects.toThrow(/Invalid BRREG response/i)
  })

  it('throws when 200 but body is not JSON', async () => {
    const mockFetch = vi.fn(async () => new Response('<html>oops</html>', { status: 200 }))
    await expect(lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: instantRetry })).rejects.toThrow()
  })
})

describe('lookupOrgNumber – headers, URL shaping & options', () => {
  it('uses Accept header and trims trailing slash in baseUrl', async () => {
    let capturedUrl = ''
    let capturedHeaders: HeadersInit | undefined

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedHeaders = init?.headers
      return json({ organisasjonsnummer: '509100675' })
    })

    const opts: LookupOptions = {
      baseUrl: 'https://data.brreg.no/enhetsregisteret/api/',
      fetchFn: mockFetch as any,
      headers: { 'X-Custom': 'yes' },
      retry: instantRetry,
    }

    await lookupOrgNumber('509100675', opts)
    expect(capturedUrl).toBe('https://data.brreg.no/enhetsregisteret/api/enheter/509100675')

    const headersObj =
      capturedHeaders instanceof Headers
        ? Object.fromEntries(capturedHeaders.entries())
        : (capturedHeaders as Record<string, string>)

    expect(headersObj?.accept ?? headersObj?.Accept).toMatch(
      /application\/vnd\.brreg\.enhetsregisteret\.enhet\.v2\+json/i,
    )
    expect(headersObj?.['X-Custom']).toBe('yes')
  })

  it('does not retry when retry=false', async () => {
    const mockFetch = vi.fn(async () => {
      throw new Error('Network down')
    })

    await expect(
      lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: false }),
    ).rejects.toThrow(/Network down/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('lookupOrgNumber – retry behavior', () => {
  it('retries network failures and eventually succeeds', async () => {
    let calls = 0
    const mockFetch = vi.fn(async () => {
      calls++
      if (calls < 3) throw new Error('Network error')
      return json({ organisasjonsnummer: '509100675' })
    })

    const result = await lookupOrgNumber('509100675', {
      fetchFn: mockFetch as any,
      retry: { ...instantRetry, retries: 5 },
    })
    expect(result.organisasjonsnummer).toBe('509100675')
    expect(calls).toBe(3)
  })

  it('retries 5xx and then fails with last error when limit reached', async () => {
    let calls = 0
    const mockFetch = vi.fn(async () => {
      calls++
      return new Response('server sad', { status: 500 })
    })

    await expect(
      lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: { ...instantRetry, retries: 2 } }),
    ).rejects.toThrow(/Server error 500/i)
    expect(calls).toBe(3)
  })

  it('does NOT retry on 4xx (e.g., 400), returns structured error immediately', async () => {
    const mockFetch = vi.fn(async () =>
      json(
        {
          antallFeil: 1,
          valideringsfeil: [{ feilmelding: 'Bad value', feilaktigVerdi: 'x' }],
          feilmelding: 'General validation error',
          status: 400,
        },
        400,
      ),
    )

    await expect(
      lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: instantRetry }),
    ).rejects.toThrow(/validation error/i)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('lookupOrgNumber – structured BRREG errors', () => {
  it('410 Gone: includes deletion date in message', async () => {
    const mockFetch = vi.fn(async () =>
      json(
        {
          organisasjonsnummer: '509100675',
          slettedato: '2024-03-09',
          _links: { self: { href: 'https://data.brreg.no/enhetsregisteret/api/enheter/509100675' } },
        },
        410,
      ),
    )

    await expect(lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: instantRetry }))
      .rejects.toThrow(/deleted on 2024-03-09/)
  })

  it('400 Bad Request: prefers feilmelding if present', async () => {
    const mockFetch = vi.fn(async () =>
      json(
        {
          antallFeil: 1,
          valideringsfeil: [{ feilmelding: 'Specific field invalid', parametere: ['x'] }],
          feilmelding: 'Top-level validation message',
          status: 400,
        },
        400,
      ),
    )

    await expect(lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: instantRetry }))
      .rejects.toThrow(/Top-level validation message/i)
  })

  it('500 Internal Server Error: shows BRREG server error message', async () => {
    const mockFetch = vi.fn(async () =>
      json(
        {
          timestamp: '2024-01-05T07:36:21.523+0000',
          status: 500,
          error: 'Internal Server Error',
          message: 'Internal Server Error',
          path: '/enhetsregisteret/api/enheter',
        },
        500,
      ),
    )

    await expect(
      lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: { ...instantRetry, retries: 1 } }),
    ).rejects.toThrow(/server error 500|Internal Server Error/i)
  })
})

describe('lookupOrgNumber – abort handling & fetch presence', () => {
  it('propagates abort via options.signal', async () => {
    const ac = new AbortController()

    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        throw new Error('aborted')
      }
      
      ac.abort()
      if (init?.signal?.aborted) {
        throw new Error('aborted')
      }
      return json({ organisasjonsnummer: '509100675' })
    })

    await expect(
      lookupOrgNumber('509100675', {
        fetchFn: mockFetch as any,
        signal: ac.signal,
        retry: instantRetry,
      }),
    ).rejects.toThrow(/aborted/i)
  })

  it('throws a clear error if no fetch implementation is available', async () => {
    const originalFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = undefined

    await expect(lookupOrgNumber('509100675')).rejects.toThrow(/No fetch implementation found/i)

    ;(globalThis as any).fetch = originalFetch
  })
})

describe('lookupOrgNumber – edge cases', () => {
  it('passes through unknown fields due to schema passthrough', async () => {
    const mockFetch = vi.fn(async () =>
      json({
        organisasjonsnummer: '509100675',
        navn: 'Unknown Fields Inc.',
        someNewApiField: { nested: true },
      }),
    )

    const out = await lookupOrgNumber('509100675', { fetchFn: mockFetch as any, retry: instantRetry })
    // @ts-expect-error dynamic field allowed at runtime
    expect(out.someNewApiField?.nested).toBe(true)
  })

  it('does not double-encode or double-slash the url', async () => {
    let capturedUrl = ''
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return json({ organisasjonsnummer: '509100675' })
    })

    await lookupOrgNumber('509100675', {
      baseUrl: 'https://data.brreg.no/enhetsregisteret/api/',
      fetchFn: mockFetch as any,
      retry: instantRetry,
    })

    expect(capturedUrl).toBe('https://data.brreg.no/enhetsregisteret/api/enheter/509100675')
  })
})
