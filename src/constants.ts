export const DEFAULT_BASE = 'https://data.brreg.no/enhetsregisteret/api'
export const ACCEPT = 'application/vnd.brreg.enhetsregisteret.enhet.v2+json;charset=UTF-8'

export function normalizeBase(base?: string): string {
  return (base ?? DEFAULT_BASE).replace(/\/+$/, '')
}

export function joinUrl(base: string, path: string): string {
  // ensures exactly one slash between base and path
  const b = base.replace(/\/+$/, '')
  const p = path.replace(/^\/+/, '')
  return `${b}/${p}`
}
