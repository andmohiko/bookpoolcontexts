import type { Book } from '@bookpoolcontexts/common'
import { Badge } from '@/components/ui/badge'

type BookCardProps = {
  book: Book
  onClick: (book: Book) => void
}

export const BookCard = ({ book, onClick }: BookCardProps) => {
  return (
    <button
      type="button"
      className="relative aspect-[4/5] w-full rounded-lg border overflow-hidden transition-colors hover:bg-accent"
      onClick={() => onClick(book)}
    >
      {book.coverImageUrl ? (
        <img
          src={book.coverImageUrl}
          alt={book.title ?? ''}
          className="h-[calc(100%-32px)] w-full object-contain"
        />
      ) : (
        <div className="flex h-[calc(100%-32px)] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          No Image
        </div>
      )}
      <div className="flex h-8 items-center gap-1 overflow-x-auto px-1.5">
        {book.tags.length > 0 ? (
          book.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))
        ) : null}
      </div>
      {book.isRead && (
        <span className="absolute top-1 right-1 rounded bg-background/80 px-1 text-[10px] text-muted-foreground">
          読了
        </span>
      )}
    </button>
  )
}
