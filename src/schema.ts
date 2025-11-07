import { z } from 'zod'

/**
 * Zod schema describing the structure of a BRREG "Enhet" record.
 * Only key fields are strictly defined — unknown fields are allowed.
 */
export const BrregEnhetSchema = z
  .object({
    responseClass: z.string().optional(),
    organisasjonsnummer: z.string().regex(/^\d{9}$/, 'Expected 9 digits').optional(),
    navn: z.string().optional(),

    organisasjonsform: z
      .object({
        _links: z
          .object({
            self: z.object({ href: z.string().url().or(z.string()) }).partial(),
          })
          .partial()
          .optional(),
        kode: z.string().optional(),
        utgaatt: z.string().optional(),
        beskrivelse: z.string().optional(),
      })
      .partial()
      .optional(),

    postadresse: z.unknown().optional(),
    forretningsadresse: z.unknown().optional(),

    registrertIMvaregisteret: z.boolean().optional(),
    maalform: z.string().optional(),

    naeringskode1: z.object({ kode: z.string().optional(), beskrivelse: z.string().optional() }).partial().optional(),
    naeringskode2: z.object({ kode: z.string().optional(), beskrivelse: z.string().optional() }).partial().optional(),
    naeringskode3: z.object({ kode: z.string().optional(), beskrivelse: z.string().optional() }).partial().optional(),

    _links: z
      .object({
        overordnetEnhet: z.object({ href: z.string().url().or(z.string()) }).partial().optional(),
        self: z.object({ href: z.string().url().or(z.string()) }).partial().optional(),
      })
      .partial()
      .optional(),
  })
  .catchall(z.unknown())

export type BrregEnhet = z.infer<typeof BrregEnhetSchema>

export const PageSchema = z.object({
  number: z.number(),
  size: z.number(),
  totalPages: z.number(),
  totalElements: z.number(),
})

const LinkObj = z.object({ href: z.string() }).partial()
export const LinksSchema = z
  .object({
    self: LinkObj.optional(),
    first: LinkObj.optional(),
    prev: LinkObj.optional(),
    next: LinkObj.optional(),
    last: LinkObj.optional(),
  })
  .partial()

export const EnheterSearchResponseSchema = z
  .object({
    _links: LinksSchema.optional(),
    _embedded: z
      .object({
        enheter: z.array(BrregEnhetSchema),
      })
      .optional(),
    page: PageSchema.optional(),
  })
  .catchall(z.unknown())

export type EnheterSearchResponse = z.infer<typeof EnheterSearchResponseSchema>
