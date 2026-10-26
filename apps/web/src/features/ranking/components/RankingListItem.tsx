import type { Book } from '@bookpoolcontexts/common'

type RankingListItemProps = {
  book: Book
  rank: number
  onClick: (book: Book, rank: number) => void
}

export const RankingListItem = ({
  book,
  rank,
  onClick,
}: RankingListItemProps) => {
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(book, rank)}
        className="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="w-8 shrink-0 text-center text-base font-semibold tabular-nums text-muted-foreground">
          {rank}
        </span>
        <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
          {book.coverImageUrl ? (
            <img
              src={book.coverImageUrl}
              alt={book.title ?? ''}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">No Image</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-medium">
            {book.title ?? 'タイトル未取得'}
          </span>
          {book.author && (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {book.author}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}
