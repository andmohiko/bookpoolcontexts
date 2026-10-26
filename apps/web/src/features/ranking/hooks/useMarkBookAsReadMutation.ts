import type { BookId, UpdateBookDto } from '@bookpoolcontexts/common'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateBookOperation } from '@/infrastructure/firestore/books'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseMarkBookAsReadMutationReturn = {
  markAsRead: (bookId: BookId) => Promise<void>
  isMarking: boolean
}

/**
 * 本を読了にする。
 *
 * ランキングの各配列からの除去は Cloud Functions の onUpdateBook が行うため、
 * ここでは isRead のみを更新する（仕様 FR-RANK-002 / 4.7）。
 */
export const useMarkBookAsReadMutation = (): UseMarkBookAsReadMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isMarking, setIsMarking] = useState(false)

  const markAsRead = async (bookId: BookId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')

    setIsMarking(true)
    try {
      const dto: UpdateBookDto = {
        isRead: true,
        updatedAt: serverTimestamp,
        updatedBy: 'user' as const,
      }
      await updateBookOperation(uid, bookId, dto)
      toast.success('読了にしました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsMarking(false)
    }
  }

  return { markAsRead, isMarking }
}
