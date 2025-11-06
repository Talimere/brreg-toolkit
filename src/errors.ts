export interface BrregApiError extends Error {
  status: number
  details?: any
  url?: string
}

export async function handleBrregError(res: Response): Promise<never> {
  const text = await safeText(res)
  let details: any
  try {
    details = text ? JSON.parse(text) : undefined
  } catch {
    // ignore parsing errors
  }

  const err: BrregApiError = Object.assign(new Error(), {
    name: 'BrregApiError',
    message: buildErrorMessage(res.status, details),
    status: res.status,
    details,
    url: res.url,
  })

  throw err
}

function buildErrorMessage(status: number, body: any): string {
  if (status === 400 && body?.feilmelding) {
    return `BRREG validation error: ${body.feilmelding}`
  }
  if (status === 410 && body?.slettedato) {
    return `Organization ${body.organisasjonsnummer ?? ''} was deleted on ${body.slettedato}.`
  }
  if (status >= 500) {
    return `BRREG server error ${status}: ${body?.error ?? body?.message ?? 'Unknown error'}`
  }
  return `BRREG request failed with status ${status}`
}

async function safeText(res: Response) {
  try {
    return await res.text()
  } catch {
    return null
  }
}
