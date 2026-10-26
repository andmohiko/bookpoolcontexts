import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PlayCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ComparisonView } from '@/features/ranking/components/ComparisonView'
import { ExcludedBooksSection } from '@/features/ranking/components/ExcludedBooksSection'
import { RankingEmptyState } from '@/features/ranking/components/RankingEmptyState'
import { RankingList } from '@/features/ranking/components/RankingList'
import { PendingBooksNotice } from '@/features/ranking/components/PendingBooksNotice'
import { RebuildRankingAlertDialog } from '@/features/ranking/components/RebuildRankingAlertDialog'
import { UnrankedBooksSection } from '@/features/ranking/components/UnrankedBooksSection'
import { useFinalizeRankingMutation } from '@/features/ranking/hooks/useFinalizeRankingMutation'
import { useRankingProgress } from '@/features/ranking/hooks/useRankingProgress'
import { useStartRankingMutation } from '@/features/ranking/hooks/useStartRankingMutation'
import type { SortInput } from '@/features/ranking/utils/sortEngine'
import { estimateMaxComparisons } from '@/features/ranking/utils/sortEngine'
import { useDisclosure } from '@/hooks/useDisclosure'

export const Route = createFileRoute('/_authed/ranking')({
  component: RankingPage,
})

function RankingPage() {
  const navigate = useNavigate()
  const {
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
    isLoading,
  } = useRankingProgress()

  const { startCreate, startUpdate, isStarting } =
    useStartRankingMutation(ranking)
  const { finalize } = useFinalizeRankingMutation()
  const rebuildDisclosure = useDisclosure()

  /**
   * 2択画面を開いているか。
   *
   * create モードの中断中は旧ランキングを保持しているため、
   * 画面を開いた直後は旧ランキングと再開バナーを見せ、
   * ユーザーが「再開」を押してから2択に入る（仕様 FR-RANK-001）。
   * update モードは旧ランキングを置き換える前提なので即座に2択へ入る。
   */
  const [isComparing, setIsComparing] = useState(false)

  const excludedBookIdSet = useMemo(
    () => new Set(ranking?.excludedBookIds ?? []),
    [ranking?.excludedBookIds],
  )

  /** 作成・作り直しの対象は「除外を除いた未読本すべて」 */
  const createTargetBooks = useMemo(
    () => unreadBooks.filter((book) => !excludedBookIdSet.has(book.bookId)),
    [unreadBooks, excludedBookIdSet],
  )

  const isSorting = ranking?.status === 'sorting'
  const hasRanking = rankedBooks.length > 0

  // ソートが終わったら2択画面を閉じる
  useEffect(() => {
    if (!isSorting) setIsComparing(false)
  }, [isSorting])

  /**
   * 候補が除外・削除・読了で減り、残りの回答ログだけでソートが成立した場合、
   * 2択を出さずに completed になる。この場合は確定処理をここで行う。
   * ComparisonView は needComparison のときだけ描画されるため、ここが唯一の経路。
   */
  const completedOrder =
    isSorting && progress?.status === 'completed' ? progress.order : null
  // 配列は毎回新しい参照になるため、最新値は ref で渡し、
  // useEffect の再実行は内容ベースのキーだけで判定する
  const completedOrderRef = useRef<Array<string> | null>(null)
  completedOrderRef.current = completedOrder
  const completedOrderKey = completedOrder ? JSON.stringify(completedOrder) : null

  const isFinalizingRef = useRef(false)
  useEffect(() => {
    const order = completedOrderRef.current
    if (completedOrderKey === null || order === null) return
    if (isFinalizingRef.current) return

    isFinalizingRef.current = true
    finalize(order)
      .catch(() => {
        // トースト通知はフック内で行うため握りつぶす
      })
      .finally(() => {
        isFinalizingRef.current = false
      })
  }, [completedOrderKey, finalize])

  const sortInput = useMemo((): SortInput | null => {
    if (!ranking || ranking.status !== 'sorting' || ranking.mode === null) {
      return null
    }
    const validCandidateBookIds = ranking.candidateBookIds.filter(
      (bookId) => bookMap.has(bookId) && !excludedBookIdSet.has(bookId),
    )
    const validRankedBookIds = ranking.rankedBookIds.filter(
      (bookId) => bookMap.has(bookId) && !excludedBookIdSet.has(bookId),
    )
    return {
      mode: ranking.mode,
      candidateBookIds: validCandidateBookIds,
      baseRankedBookIds: ranking.mode === 'update' ? validRankedBookIds : [],
      decisions: ranking.decisions,
    }
  }, [ranking, bookMap, excludedBookIdSet])

  const handleStartCreate = async (): Promise<void> => {
    try {
      await startCreate(createTargetBooks)
      setIsComparing(true)
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  const handleStartUpdate = async (): Promise<void> => {
    try {
      await startUpdate(unrankedBooks)
      setIsComparing(true)
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  const handleLeave = (): void => {
    void navigate({ to: '/' })
  }

  if (isLoading) {
    return (
      <main className="pb-8 pt-4">
        <Skeleton className="mb-6 h-7 w-56" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </main>
    )
  }

  /**
   * 2択画面を出す条件。
   * 旧ランキングがない（= 中断しても見せるものがない）場合は常に2択へ入り、
   * 旧ランキングがある場合は「再開」を押したときだけ入る。
   */
  const shouldShowComparison =
    isSorting &&
    progress?.status === 'needComparison' &&
    sortInput !== null &&
    ranking !== null &&
    (isComparing || !hasRanking || ranking.mode === 'update')

  // 状態B: 2択画面
  if (shouldShowComparison && ranking && progress.status === 'needComparison') {
    return (
      <main className="pb-8 pt-4">
        <ComparisonView
          ranking={ranking}
          progress={progress}
          sortInput={sortInput}
          bookMap={bookMap}
          onLeave={handleLeave}
        />
      </main>
    )
  }

  // 状態A: ランキング未作成
  if (!hasRanking) {
    return (
      <main className="pb-8 pt-4">
        <h1 className="mb-6 text-xl font-semibold">読みたい本ランキング</h1>
        <div className="flex flex-col gap-4">
          <RankingEmptyState
            targetCount={createTargetBooks.length}
            maxComparisons={createMaxComparisons}
            isStarting={isStarting}
            onStart={() => void handleStartCreate()}
          />
          <PendingBooksNotice
            pendingBooks={pendingBooks}
            duplicateBooks={duplicateBooks}
          />
          <ExcludedBooksSection
            books={excludedBooks}
            canUnexclude={!isSorting}
          />
        </div>
      </main>
    )
  }

  // 状態C: ランキング表示
  const updateMaxComparisons = estimateMaxComparisons(
    'update',
    unrankedBooks.length,
    rankedBooks.length,
  )

  return (
    <main className="pb-8 pt-4">
      <div className="mb-4 flex flex-col gap-3">
        <h1 className="text-xl font-semibold">読みたい本ランキング</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleStartUpdate()}
            disabled={isStarting || isSorting || unrankedBooks.length === 0}
            title={
              unrankedBooks.length > 0
                ? `最大 ${updateMaxComparisons} 回の比較`
                : undefined
            }
          >
            ランキングを更新（未追加 {unrankedBooks.length} 冊）
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={rebuildDisclosure.open}
            disabled={isStarting || isSorting || createTargetBooks.length < 2}
          >
            作り直す
          </Button>
        </div>
      </div>

      {isSorting && progress?.status === 'needComparison' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <span className="text-sm">
            中断中のソートがあります（{progress.answered} / 最大{' '}
            {progress.maxTotal} 問）
          </span>
          <Button type="button" size="sm" onClick={() => setIsComparing(true)}>
            <PlayCircle className="size-4" />
            中断中のソートを再開
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <RankingList
          books={rankedBooks}
          ranking={ranking}
          canExclude={!isSorting}
        />
        <PendingBooksNotice
          pendingBooks={pendingBooks}
          duplicateBooks={duplicateBooks}
        />
        <UnrankedBooksSection books={unrankedBooks} />
        <ExcludedBooksSection books={excludedBooks} canUnexclude={!isSorting} />
      </div>

      {rebuildDisclosure.isOpen && (
        <RebuildRankingAlertDialog
          isOpen={rebuildDisclosure.isOpen}
          onClose={rebuildDisclosure.close}
          targetBooks={createTargetBooks}
          maxComparisons={createMaxComparisons}
          isStarting={isStarting}
          onConfirm={handleStartCreate}
        />
      )}
    </main>
  )
}
