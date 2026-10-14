import type { Book, BookId } from '@bookpoolcontexts/common'
import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useUnexcludeBookMutation } from '@/features/ranking/hooks/useUnexcludeBookMutation'

type ExcludedBooksSectionProps = {
  books: Array<Book>
  /** ソート進行中は解除できない（進捗が巻き戻って見えるため） */
  canUnexclude: boolean
}

export const ExcludedBooksSection = ({
  books,
  canUnexclude,
}: ExcludedBooksSectionProps) => {
  const { unexclude, isUnexcluding } = useUnexcludeBookMutation()

  if (books.length === 0) return null

  const handleUnexclude = async (bookId: BookId): Promise<void> => {
    try {
      await unexclude(bookId)
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        除外した本 ({books.length})
      </summary>
      <ul className="flex flex-col gap-2 border-t p-3">
        {!canUnexclude && (
          <li className="text-xs text-muted-foreground">
            ソート中は除外を解除できません。ソートを完了または破棄してください。
          </li>
        )}
        {books.map((book) => (
          <li key={book.bookId} className="flex items-center gap-3">
            <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
              {book.coverImageUrl ? (
                <img
                  src={book.coverImageUrl}
                  alt={book.title ?? ''}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  No Image
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-2 text-sm">
                {book.title ?? 'タイトル未取得'}
              </span>
              {book.author && (
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {book.author}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleUnexclude(book.bookId)}
              disabled={!canUnexclude || isUnexcluding}
              className="shrink-0"
            >
              除外を解除
            </Button>
          </li>
        ))}
      </ul>
    </details>
  )
}
