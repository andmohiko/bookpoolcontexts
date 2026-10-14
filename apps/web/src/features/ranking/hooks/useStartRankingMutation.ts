import type {
  Book,
  CreateRankingDto,
  Ranking,
  UpdateRankingDto,
} from '@bookpoolcontexts/common'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  createRankingOperation,
  updateRankingOperation,
} from '@/infrastructure/firestore/rankings'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseStartRankingMutationReturn = {
  /** 未読本全体を対象にマージソートを開始する（新規作成・作り直し） */
  startCreate: (targetBooks: Array<Book>) => Promise<void>
  /** 未追加の本を既存ランキングへ二分挿入するソートを開始する */
  startUpdate: (unrankedBooks: Array<Book>) => Promise<void>
  isStarting: boolean
}

/**
 * ソートを開始する。
 *
 * ドキュメントが未作成なら setDoc、既存なら updateDoc で status を sorting にする。
 * rankedBookIds は完了まで保持し、旧ランキングを表示できるようにする。
 */
export const useStartRankingMutation = (
  ranking: Ranking | null,
): UseStartRankingMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isStarting, setIsStarting] = useState(false)

  const start = async (
    mode: 'create' | 'update',
    candidateBookIds: Array<string>,
  ): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')

    setIsStarting(true)
    try {
      if (ranking) {
        const dto: UpdateRankingDto = {
          status: 'sorting',
          mode,
          candidateBookIds,
          decisions: [],
          updatedAt: serverTimestamp,
        }
        await updateRankingOperation(uid, dto)
      } else {
        const dto: CreateRankingDto = {
          status: 'sorting',
          mode,
          candidateBookIds,
          decisions: [],
          rankedBookIds: [],
          excludedBookIds: [],
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        }
        await createRankingOperation(uid, dto)
      }
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsStarting(false)
    }
  }

  const startCreate = async (targetBooks: Array<Book>): Promise<void> => {
    // 同じ ID が混ざると 2 択の左右に同じ本が並ぶため、念のため重複を除く
    const candidateBookIds = [
      ...new Set(targetBooks.map((book) => book.bookId)),
    ]
    if (candidateBookIds.length < 2) {
      toast.error('ランキングを作るには未読の本が2冊以上必要です')
      return
    }
    await start('create', candidateBookIds)
  }

  const startUpdate = async (unrankedBooks: Array<Book>): Promise<void> => {
    // 既存ランキングに含まれる本は候補にしない（自分自身との比較を防ぐ）
    const rankedBookIdSet = new Set(ranking?.rankedBookIds ?? [])
    const candidateBookIds = [
      ...new Set(unrankedBooks.map((book) => book.bookId)),
    ].filter((bookId) => !rankedBookIdSet.has(bookId))

    if (candidateBookIds.length === 0) {
      toast.error('ランキングに追加する本がありません')
      return
    }
    await start('update', candidateBookIds)
  }

  return { startCreate, startUpdate, isStarting }
}
