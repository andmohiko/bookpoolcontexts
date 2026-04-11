import type { CreateBookDto, ScrapingStatus } from '@bookpoolcontexts/common'
import { useState } from 'react'
import { toast } from 'sonner'
import { parseAmazonHtml } from '@/features/books/utils/parseAmazonHtml'
import { createBookOperation } from '@/infrastructure/firestore/books'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type CreateBookInput = {
  amazonUrl: string
  amazonHtml: string
  tags: string[]
  foundBy: string
  location: string
  purchasedBy: string[]
  groups: string[]
  note: string
  isRead: boolean
}

export type UseCreateBookMutationReturn = {
  createBook: (input: CreateBookInput) => Promise<void>
  isCreating: boolean
}

export const useCreateBookMutation = (): UseCreateBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isCreating, setIsCreating] = useState(false)

  const createBook = async (input: CreateBookInput): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsCreating(true)
    try {
      // amazonHtml は保存しないため分離
      const { amazonHtml, ...rest } = input

      // scrapingStatus は HTMLの有無だけで決定する。
      // HTMLがあれば URL が一緒に入力されていても skipped（= スクレイピング不要の意思表示）
      const hasHtml = amazonHtml.trim() !== ''

      let title: string | null = null
      let author: string | null = null
      let coverImageUrl: string | null = null
      let pages: number | null = null
      let scrapingStatus: ScrapingStatus = 'scraping'

      if (hasHtml) {
        const parsed = parseAmazonHtml(amazonHtml)
        title = parsed.title
        author = parsed.author
        coverImageUrl = parsed.coverImageUrl
        pages = parsed.pages
        scrapingStatus = 'skipped'
      }

      const dto: CreateBookDto = {
        ...rest,
        title,
        author,
        coverImageUrl,
        pages,
        scrapingStatus,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
        updatedBy: 'user' as const,
      }
      await createBookOperation(uid, dto)
      toast.success('本を登録しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsCreating(false)
    }
  }

  return { createBook, isCreating }
}
