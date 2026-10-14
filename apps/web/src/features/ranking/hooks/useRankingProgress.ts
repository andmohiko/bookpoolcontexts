import type { Book, BookId, Ranking } from '@bookpoolcontexts/common'
import { useMemo } from 'react'

import { useRanking } from '@/features/ranking/hooks/useRanking'
import type { DuplicateBook } from '@/features/ranking/hooks/useUnreadBooks'
import { useUnreadBooks } from '@/features/ranking/hooks/useUnreadBooks'
import type { SortProgress } from '@/features/ranking/utils/sortEngine'
import {
  computeSortProgress,
  estimateMaxComparisons,
} from '@/features/ranking/utils/sortEngine'

export type UseRankingProgressReturn = {
  ranking: Ranking | null
  /** 未読本の全件（createdAt 昇順） */
  unreadBooks: Array<Book>
  bookMap: Map<BookId, Book>
  /** 確定済みランキングのうち、現在も有効な本 */
  rankedBooks: Array<Book>
  /** ランキングにも除外リストにも含まれていない未読本 */
  unrankedBooks: Array<Book>
  /** 除外した本のうち、現在も未読として存在するもの */
  excludedBooks: Array<Book>
  /** ソート進行中の進捗。それ以外は null */
  progress: SortProgress | null
  /** 新規作成を開始した場合の最大比較回数（状態A・作り直しの案内用） */
  createMaxComparisons: number
  /** タイトル未取得でランキング対象外になった未読本 */
  pendingBooks: Array<Book>
  /** 同じ本の重複登録として除外した本 */
  duplicateBooks: Array<DuplicateBook>
  isLoading: boolean
  error: string | null
}

/**
 * ランキングと未読本から画面表示に必要な派生値を計算する。
 *
 * 状態は持たず、すべて useMemo による導出。
 * 削除・読了になった本（bookMap に存在しない ID）と除外済みの本は
 * ソートエンジンに渡す前にここで取り除く。
 */
export const useRankingProgress = (): UseRankingProgressReturn => {
  const { ranking, isLoading: isLoadingRanking, error: rankingError } = useRanking()
  const {
    books: unreadBooks,
    pendingBooks,
    duplicateBooks,
    bookMap,
    isLoading: isLoadingBooks,
    error: booksError,
  } = useUnreadBooks()

  const excludedBookIdSet = useMemo(
    () => new Set(ranking?.excludedBookIds ?? []),
    [ranking?.excludedBookIds],
  )

  const rankedBookIdSet = useMemo(
    () => new Set(ranking?.rankedBookIds ?? []),
    [ranking?.rankedBookIds],
  )

  /** 現在も未読として存在し、除外されていない本かどうか */
  const isActiveBookId = useMemo(
    () =>
      (bookId: BookId): boolean =>
        bookMap.has(bookId) && !excludedBookIdSet.has(bookId),
    [bookMap, excludedBookIdSet],
  )

  const validCandidateBookIds = useMemo(
    () => (ranking?.candidateBookIds ?? []).filter(isActiveBookId),
    [ranking?.candidateBookIds, isActiveBookId],
  )

  const validRankedBookIds = useMemo(
    () => (ranking?.rankedBookIds ?? []).filter(isActiveBookId),
    [ranking?.rankedBookIds, isActiveBookId],
  )

  const rankedBooks = useMemo(
    () =>
      validRankedBookIds
        .map((bookId) => bookMap.get(bookId))
        .filter((book): book is Book => book !== undefined),
    [validRankedBookIds, bookMap],
  )

  const unrankedBooks = useMemo(
    () =>
      unreadBooks.filter(
        (book) =>
          !rankedBookIdSet.has(book.bookId) &&
          !excludedBookIdSet.has(book.bookId),
      ),
    [unreadBooks, rankedBookIdSet, excludedBookIdSet],
  )

  const excludedBooks = useMemo(
    () =>
      (ranking?.excludedBookIds ?? [])
        .map((bookId) => bookMap.get(bookId))
        .filter((book): book is Book => book !== undefined),
    [ranking?.excludedBookIds, bookMap],
  )

  const progress = useMemo((): SortProgress | null => {
    if (!ranking || ranking.status !== 'sorting' || ranking.mode === null) {
      return null
    }
    return computeSortProgress({
      mode: ranking.mode,
      candidateBookIds: validCandidateBookIds,
      // create では旧ランキングを順位の根拠にしない
      baseRankedBookIds: ranking.mode === 'update' ? validRankedBookIds : [],
      decisions: ranking.decisions,
    })
  }, [ranking, validCandidateBookIds, validRankedBookIds])

  /** 作成・作り直しの対象は「除外を除いた未読本すべて」 */
  const createTargetCount = useMemo(
    () =>
      unreadBooks.filter((book) => !excludedBookIdSet.has(book.bookId)).length,
    [unreadBooks, excludedBookIdSet],
  )

  const createMaxComparisons = useMemo(
    () => estimateMaxComparisons('create', createTargetCount, 0),
    [createTargetCount],
  )

  return {
    ranking,
    unreadBooks,
    bookMap,
    rankedBooks,
    unrankedBooks,
    excludedBooks,
    progress,
    createMaxComparisons,
    pendingBooks,
    duplicateBooks,
    isLoading: isLoadingRanking || isLoadingBooks,
    error: rankingError ?? booksError,
  }
}
