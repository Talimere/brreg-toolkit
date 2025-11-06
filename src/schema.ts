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
  .passthrough()

export type BrregEnhet = z.infer<typeof BrregEnhetSchema>
