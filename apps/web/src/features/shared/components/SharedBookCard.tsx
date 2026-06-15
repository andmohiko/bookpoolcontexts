import type { SharedBook } from '@bookpoolcontexts/common'
import { Badge } from '@/components/ui/badge'

type SharedBookCardProps = {
  book: SharedBook
}

export const SharedBookCard = ({ book }: SharedBookCardProps) => {
  return (
    <div className="relative aspect-[4/5] w-full rounded-lg border overflow-hidden">
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
        {book.tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="shrink-0 text-[10px] px-1.5 py-0"
          >
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  )
}
