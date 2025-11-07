import type { RetryOptions } from './retry'
export type { BrregEnhet } from './schema'

export interface LookupOptions {
  baseUrl?: string
  fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  headers?: Record<string, string>
  signal?: AbortSignal
  retry?: RetryOptions | false
}

export type EnheterSortField =
  | 'navn'
  | 'organisasjonsnummer'
  | 'overordnetEnhet'
  | 'organisasjonsform.kode'
  | 'antallAnsatte'
  | 'hjemmeside'
  | 'postadresse.kommune'
  | 'postadresse.kommunenummer'
  | 'registreringsdatoEnhetsregisteret'
  | 'registrertIMvaregisteret'
  | 'registrertIForetaksregisteret'
  | 'registrertIStiftelsesregisteret'
  | 'registrertIFrivillighetsregisteret'
  | 'naeringskode1.kode'
  | 'naeringskode2.kode'
  | 'naeringskode3.kode'
  | 'hjelpeenhetskode.kode'
  | 'forretningsadresse.kommune'
  | 'forretningsadresse.kommunenummer'
  | 'stiftelsesdato'
  | 'institusjonellSektorkode.kode'
  | 'konkurs'
  | 'underAvvikling'
  | 'underTvangsavviklingEllerTvangsopplosning'

export type SortDirection = 'ASC' | 'DESC'
export type SortSpec = `${EnheterSortField},${SortDirection}` | {
  field: EnheterSortField
  direction?: SortDirection
}

export interface EnheterSearchParams {
  /** Free-text by name; BRREG uses 'navn' query param */
  navn?: string
  /** Page index (0-based); BRREG default is 0 */
  page?: number
  /** Page size; BRREG default is 20 */
  size?: number
  /** One or many sort specs */
  sort?: SortSpec | Array<SortSpec>
}

export interface EnheterSearchResult {
  items: import('./schema').BrregEnhet[]
  page: { number: number; size: number; totalPages: number; totalElements: number }
  links: Partial<Record<'self' | 'first' | 'prev' | 'next' | 'last', string>>
  /** Raw parsed body, if consumers want full shape */
  raw: unknown
}