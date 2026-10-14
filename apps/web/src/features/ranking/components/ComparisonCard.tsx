import type { Book } from '@bookpoolcontexts/common'
import { EyeOff } from 'lucide-react'
import type { MouseEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

type ComparisonCardProps = {
  book: Book
  /** 左右どちらのカードか（キーボード操作の案内に使う） */
  side: 'left' | 'right'
  onSelect: () => void
  onExclude: () => void
  disabled: boolean
}

export const ComparisonCard = ({
  book,
  side,
  onSelect,
  onExclude,
  disabled,
}: ComparisonCardProps) => {
  const scrapingStatus = book.scrapingStatus ?? 'completed'

  const handleExclude = (e: MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation()
    onExclude()
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="group flex flex-1 cursor-pointer flex-col gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-muted">
          {scrapingStatus === 'scraping' ? (
            <div className="flex flex-col items-center gap-2">
              <Spinner className="size-6" />
              <span className="text-xs text-muted-foreground">取得中...</span>
            </div>
          ) : book.coverImageUrl ? (
            <img
              src={book.coverImageUrl}
              alt={book.title ?? ''}
              className="h-full w-full object-contain"
            />
          ) : scrapingStatus === 'failed' ? (
            <span className="text-xs text-destructive">取得失敗</span>
          ) : (
            <span className="text-xs text-muted-foreground">No Image</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="line-clamp-3 text-sm font-medium">
            {book.title ?? 'タイトル未取得'}
          </span>
          {book.author ? (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {book.author}
            </span>
          ) : (
            // タイトル・著者・表紙がすべて未取得だと別の本でも見分けがつかないため、
            // Amazon の URL を識別子として表示する
            <span className="line-clamp-1 break-all text-xs text-muted-foreground">
              {book.amazonUrl}
            </span>
          )}
        </div>
        <span className="mt-auto hidden text-xs text-muted-foreground sm:inline">
          {side === 'left' ? '←' : '→'} キーでも選べます
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleExclude}
        disabled={disabled}
        className="text-muted-foreground"
      >
        <EyeOff className="size-4" />
        ランキングに含めない
      </Button>
    </div>
  )
}
