import type { Book, BookId, Ranking } from '@bookpoolcontexts/common'
import { Undo2 } from 'lucide-react'
import { useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { ComparisonCard } from '@/features/ranking/components/ComparisonCard'
import { SortProgressBar } from '@/features/ranking/components/SortProgressBar'
import { useAnswerComparisonMutation } from '@/features/ranking/hooks/useAnswerComparisonMutation'
import { useExcludeBookMutation } from '@/features/ranking/hooks/useExcludeBookMutation'
import { useUndoComparisonMutation } from '@/features/ranking/hooks/useUndoComparisonMutation'
import type { SortInput, SortProgress } from '@/features/ranking/utils/sortEngine'
import { useDisclosure } from '@/hooks/useDisclosure'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { DiscardSortAlertDialog } from '@/features/ranking/components/DiscardSortAlertDialog'

type ComparisonViewProps = {
  ranking: Ranking
  /** needComparison の進捗。completed のときは呼び出し側で表示を切り替える */
  progress: Extract<SortProgress, { status: 'needComparison' }>
  sortInput: SortInput
  bookMap: Map<BookId, Book>
  onLeave: () => void
}

export const ComparisonView = ({
  ranking,
  progress,
  sortInput,
  bookMap,
  onLeave,
}: ComparisonViewProps) => {
  const { answer, isAnswering } = useAnswerComparisonMutation(sortInput)
  const { exclude, isExcluding } = useExcludeBookMutation(ranking)
  const { undo, isUndoing } = useUndoComparisonMutation()
  const discardDisclosure = useDisclosure()

  const isBusy = isAnswering || isExcluding || isUndoing
  const leftBook = bookMap.get(progress.left)
  const rightBook = bookMap.get(progress.right)

  const handleSelect = useCallback(
    async (winner: BookId, loser: BookId): Promise<void> => {
      if (isBusy) return
      try {
        await answer(winner, loser)
      } catch {
        // トースト通知はフック内で行うため握りつぶす
      }
    },
    [answer, isBusy],
  )

  const handleSelectLeft = useCallback((): void => {
    void handleSelect(progress.left, progress.right)
  }, [handleSelect, progress.left, progress.right])

  const handleSelectRight = useCallback((): void => {
    void handleSelect(progress.right, progress.left)
  }, [handleSelect, progress.left, progress.right])

  useKeyboardShortcut('ArrowLeft', handleSelectLeft)
  useKeyboardShortcut('ArrowRight', handleSelectRight)

  const handleExclude = async (bookId: BookId): Promise<void> => {
    if (isBusy) return
    try {
      await exclude(bookId)
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  const handleUndo = async (): Promise<void> => {
    const last = ranking.decisions.at(-1)
    if (!last || isBusy) return
    try {
      await undo(last)
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  // 候補が削除・読了になった直後など、本の情報が揃わない場合がある
  if (!leftBook || !rightBook) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        本の情報を読み込んでいます...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">どちらをより読みたい？</h1>
          <Button type="button" variant="outline" size="sm" onClick={onLeave}>
            あとで続ける
          </Button>
        </div>
        <SortProgressBar
          answered={progress.answered}
          maxTotal={progress.maxTotal}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <ComparisonCard
          book={leftBook}
          side="left"
          onSelect={handleSelectLeft}
          onExclude={() => void handleExclude(leftBook.bookId)}
          disabled={isBusy}
        />
        <ComparisonCard
          book={rightBook}
          side="right"
          onSelect={handleSelectRight}
          onExclude={() => void handleExclude(rightBook.bookId)}
          disabled={isBusy}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleUndo()}
          disabled={isBusy || ranking.decisions.length === 0}
        >
          <Undo2 className="size-4" />1 つ戻る
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={discardDisclosure.open}
          disabled={isBusy}
          className="text-destructive hover:text-destructive"
        >
          ソートを破棄
        </Button>
      </div>

      {discardDisclosure.isOpen && (
        <DiscardSortAlertDialog
          isOpen={discardDisclosure.isOpen}
          onClose={discardDisclosure.close}
        />
      )}
    </div>
  )
}
