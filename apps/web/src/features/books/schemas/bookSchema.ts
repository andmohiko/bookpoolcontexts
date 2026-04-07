import { z } from 'zod'

export const bookRegistrationSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(200),
  coverImageUrl: z.string().default(''),
  amazonUrl: z.string().default(''),
  tags: z.array(z.string().max(50)).max(10).default([]),
  foundBy: z.string().max(500).default(''),
  location: z.string().max(200).default(''),
  purchasedBy: z.array(z.string()).default([]),
  groups: z.array(z.string()).default([]),
  note: z.string().max(2000).default(''),
})

export type BookRegistrationFormValues = z.infer<typeof bookRegistrationSchema>
