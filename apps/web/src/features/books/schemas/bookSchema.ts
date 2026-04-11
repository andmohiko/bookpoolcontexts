import { z } from 'zod'

export const bookRegistrationSchema = z
  .object({
    amazonUrl: z.string().default(''),
    amazonHtml: z.string().default(''),
    tags: z.array(z.string().max(50)).max(10).default([]),
    foundBy: z.string().max(500).default(''),
    location: z.string().max(200).default(''),
    purchasedBy: z.array(z.string()).default([]),
    groups: z.array(z.string()).default([]),
    note: z.string().max(2000).default(''),
  })
  .refine(
    (data) => data.amazonUrl.trim() !== '' || data.amazonHtml.trim() !== '',
    {
      message: 'AmazonのURLまたはHTMLのいずれかを入力してください',
      path: ['amazonUrl'],
    },
  )
  .refine(
    (data) => {
      if (data.amazonUrl.trim() === '') return true
      try {
        new URL(data.amazonUrl)
        return true
      } catch {
        return false
      }
    },
    { message: '有効なURLを入力してください', path: ['amazonUrl'] },
  )

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
