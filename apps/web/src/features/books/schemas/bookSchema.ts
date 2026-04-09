import { z } from 'zod'

export const bookRegistrationSchema = z.object({
  amazonUrl: z.string().url('有効なURLを入力してください'),
  tags: z.array(z.string().max(50)).max(10).default([]),
  foundBy: z.string().max(500).default(''),
  location: z.string().max(200).default(''),
  purchasedBy: z.array(z.string()).default([]),
  groups: z.array(z.string()).default([]),
  note: z.string().max(2000).default(''),
})

export type BookRegistrationFormValues = z.infer<typeof bookRegistrationSchema>

export const bookEditSchema = z.object({
  tags: z.array(z.string().max(50)).max(10).default([]),
  foundBy: z.string().max(500).default(''),
  location: z.string().max(200).default(''),
  purchasedBy: z.array(z.string()).default([]),
  groups: z.array(z.string()).default([]),
  note: z.string().max(2000).default(''),
})

export type BookEditFormValues = z.infer<typeof bookEditSchema>
