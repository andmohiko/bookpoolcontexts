import type { Book } from '@bookpoolcontexts/common'
import { RefreshCw } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useRefetchBookMutation } from '@/features/books/hooks/useRefetchBookMutation'

type BookCardProps = {
  book: Book
  onClick: (book: Book) => void
}

export const BookCard = ({ book, onClick }: BookCardProps) => {
  const scrapingStatus = book.scrapingStatus ?? 'completed'
  const { refetchBook, isRefetching } = useRefetchBookMutation()

  const handleClick = (): void => {
    onClick(book)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(book)
    }
  }

  const handleRefetch = async (e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation()
    try {
      await refetchBook(book.bookId)
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className="relative aspect-[4/5] w-full cursor-pointer rounded-lg border overflow-hidden transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {scrapingStatus === 'scraping' ? (
        <div className="flex h-[calc(100%-32px)] w-full flex-col items-center justify-center gap-2 bg-muted">
          <Spinner className="size-6" />
          <span className="text-xs text-muted-foreground">取得中...</span>
        </div>
      ) : book.coverImageUrl ? (
        <img
          src={book.coverImageUrl}
          alt={book.title ?? ''}
          className="h-[calc(100%-32px)] w-full object-contain"
        />
      ) : scrapingStatus === 'failed' ? (
        <div className="flex h-[calc(100%-32px)] w-full flex-col items-center justify-center gap-2 bg-destructive/10">
          <span className="text-xs text-destructive">取得失敗</span>
          <Button
            type="button"
            size="icon-lg"
            variant="secondary"
            aria-label="本の情報を再取得"
            onClick={handleRefetch}
            disabled={isRefetching}
          >
            <RefreshCw className="size-5" />
          </Button>
        </div>
      ) : (
        <div className="flex h-[calc(100%-32px)] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          No Image
        </div>
      )}
      <div className="flex h-8 items-center gap-1 overflow-x-auto px-1.5">
        {book.tags.length > 0
          ? book.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="shrink-0 text-[10px] px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))
          : null}
      </div>
      {book.isRead && (
        <span className="absolute top-1 right-1 rounded bg-background/80 px-1 text-[10px] text-muted-foreground">
          読了
        </span>
      )}
    </div>
  )
}
