import type { Book } from '@bookpoolcontexts/common'
import { ChevronRight } from 'lucide-react'

type UnrankedBooksSectionProps = {
  books: Array<Book>
}

export const UnrankedBooksSection = ({ books }: UnrankedBooksSectionProps) => {
  if (books.length === 0) return null

  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        ランキング未追加の本 ({books.length})
      </summary>
      <ul className="flex flex-col gap-2 border-t p-3">
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
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="line-clamp-2 text-sm">
                {book.title ?? 'タイトル未取得'}
              </span>
              {book.author && (
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {book.author}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}
