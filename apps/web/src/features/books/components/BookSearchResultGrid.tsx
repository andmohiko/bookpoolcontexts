import type { AmazonBookItem } from '@bookpoolcontexts/common'
import { Skeleton } from '@/components/ui/skeleton'

type BookSearchResultGridProps = {
  items: AmazonBookItem[]
  isLoading: boolean
  onSelect: (item: AmazonBookItem) => void
}

export const BookSearchResultGrid = ({
  items,
  isLoading,
  onSelect,
}: BookSearchResultGridProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="space-y-2">
            <Skeleton className="aspect-[2/3] w-full rounded-md" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
      {items.map((item) => (
        <button
          key={item.asin}
          type="button"
          className="group cursor-pointer space-y-2 rounded-lg p-2 text-left transition-colors hover:bg-accent"
          onClick={() => onSelect(item)}
        >
          {item.coverImageUrl ? (
            <img
              src={item.coverImageUrl}
              alt={item.title}
              className="aspect-[2/3] w-full rounded-md object-cover"
            />
          ) : (
            <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
              No Image
            </div>
          )}
          <p className="line-clamp-2 text-sm font-medium leading-tight">
            {item.title}
          </p>
        </button>
      ))}
    </div>
  )
}
