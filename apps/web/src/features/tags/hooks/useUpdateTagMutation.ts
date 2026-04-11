import { useState } from 'react'
import { toast } from 'sonner'
import type { DocumentSnapshot } from 'firebase/firestore'
import type { Book, UpdateBookDto } from '@bookpoolcontexts/common'
import { normalizeTagLabel } from '@bookpoolcontexts/common'
import {
  fetchBooksByTagOperation,
  updateBookOperation,
} from '@/infrastructure/firestore/books'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

const PAGE_SIZE = 100

export type UpdateTagInput = {
  oldLabel: string
  newLabel: string
}

export type UseUpdateTagMutationReturn = {
  updateTag: (input: UpdateTagInput) => Promise<void>
  isUpdating: boolean
}

/**
 * タグ名をリネームする。
 *
 * タグドキュメント自体は触らず、対象タグが付いた全本の `tags` 配列を
 * `[oldLabel → newLabel]` に置き換えて更新する。各本の更新が
 * `onUpdateBook` トリガーを発火させ、以下の連鎖処理で整合性が取れる:
 *  - 新ラベルの count が +1（存在しなければ新タグが自動作成）
 *  - 旧ラベルの count が -1、0 になれば旧タグが自動削除
 */
export const useUpdateTagMutation = (): UseUpdateTagMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isUpdating, setIsUpdating] = useState(false)

  const updateTag = async (input: UpdateTagInput): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')

    const oldLabel = input.oldLabel
    const newLabel = normalizeTagLabel(input.newLabel)

    if (!newLabel) {
      throw new Error('タグ名を入力してください')
    }
    if (newLabel === oldLabel) {
      return
    }

    setIsUpdating(true)
    try {
      // 対象タグを持つ全ての本をページング取得
      const targetBooks: Array<Book> = []
      let lastDoc: DocumentSnapshot | null = null
      let hasMore = true
      while (hasMore) {
        const result = await fetchBooksByTagOperation(
          uid,
          oldLabel,
          PAGE_SIZE,
          lastDoc,
        )
        targetBooks.push(...result.items)
        lastDoc = result.lastDoc
        hasMore = result.hasMore
      }

      // 各本の tags 配列を書き換え
      for (const book of targetBooks) {
        const nextTags = Array.from(
          new Set([
            ...book.tags.filter((t) => t !== oldLabel),
            newLabel,
          ]),
        )
        const dto: UpdateBookDto = {
          tags: nextTags,
          updatedAt: serverTimestamp,
          updatedBy: 'user' as const,
        }
        await updateBookOperation(uid, book.bookId, dto)
      }

      toast.success('タグ名を変更しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsUpdating(false)
    }
  }

  return { updateTag, isUpdating }
}
