import { EnheterSearchResponseSchema } from './schema'
import type {
  EnheterSearchParams,
  EnheterSearchResult,
  LookupOptions,
  SortSpec,
  EnheterSortField,
  SortDirection,
} from './types'
import { joinUrl, normalizeBase } from './constants'
import { getWithRetry } from './http'

const SORT_FIELDS: Set<EnheterSortField> = new Set([
  'navn', 'organisasjonsnummer', 'overordnetEnhet', 'organisasjonsform.kode', 'antallAnsatte',
  'hjemmeside', 'postadresse.kommune', 'postadresse.kommunenummer', 'registreringsdatoEnhetsregisteret',
  'registrertIMvaregisteret', 'registrertIForetaksregisteret', 'registrertIStiftelsesregisteret',
  'registrertIFrivillighetsregisteret', 'naeringskode1.kode', 'naeringskode2.kode', 'naeringskode3.kode',
  'hjelpeenhetskode.kode', 'forretningsadresse.kommune', 'forretningsadresse.kommunenummer', 'stiftelsesdato',
  'institusjonellSektorkode.kode', 'konkurs', 'underAvvikling', 'underTvangsavviklingEllerTvangsopplosning',
])

function toSortParam(spec: SortSpec): string {
  if (typeof spec === 'string') {
    const [field, dir] = spec.split(',') as [EnheterSortField, SortDirection?]
    if (!SORT_FIELDS.has(field)) throw new Error(`Invalid sort field: ${field}`)
    if (dir && dir !== 'ASC' && dir !== 'DESC') throw new Error(`Invalid sort direction: ${dir}`)
    return dir ? `${field},${dir}` : field
  }
  if (!SORT_FIELDS.has(spec.field)) throw new Error(`Invalid sort field: ${spec.field}`)
  const dir = spec.direction ?? 'ASC'
  if (dir !== 'ASC' && dir !== 'DESC') throw new Error(`Invalid sort direction: ${dir}`)
  return `${spec.field},${dir}`
}

/** Search BRREG Enhetsregisteret (GET /enheter) */
export async function searchEnheter(
  params: EnheterSearchParams = {},
  options: LookupOptions = {},
): Promise<EnheterSearchResult> {
  const base = normalizeBase(options.baseUrl)
  const url = new URL(joinUrl(base, '/enheter'))

  if (params.navn) url.searchParams.set('navn', params.navn)
  if (typeof params.page === 'number') url.searchParams.set('page', String(params.page))
  if (typeof params.size === 'number') url.searchParams.set('size', String(params.size))

  if (params.sort) {
    const list = Array.isArray(params.sort) ? params.sort : [params.sort]
    for (const s of list) url.searchParams.append('sort', toSortParam(s))
  }

  const res = await getWithRetry(url.toString(), options)
  const json = await res.json()

  const parsed = EnheterSearchResponseSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')} - ${i.message}`).join('; ')
    throw new Error(`Invalid BRREG search response: ${issues || 'unknown validation error'}`)
  }

  const body = parsed.data
  const items = body._embedded?.enheter ?? []
  const page = body.page ?? { number: 0, size: items.length, totalPages: 1, totalElements: items.length }
  const links = {
    self: body._links?.self?.href,
    first: body._links?.first?.href,
    prev: body._links?.prev?.href,
    next: body._links?.next?.href,
    last: body._links?.last?.href,
  }

  return { items, page, links, raw: body }
}
