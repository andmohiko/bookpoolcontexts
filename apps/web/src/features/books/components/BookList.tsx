import { useEffect, useRef } from 'react'
import type { Book } from '@bookpoolcontexts/common'
import { Skeleton } from '@/components/ui/skeleton'
import { BookCard } from '@/features/books/components/BookCard'
import { useBooks } from '@/features/books/hooks/useBooks'

type BookListProps = {
  tag?: string
  onClickBook: (book: Book) => void
}

export const BookList = ({ tag, onClickBook }: BookListProps) => {
  const { books, isLoading, isLoadingMore, hasMore, loadMore } = useBooks(tag)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 無限スクロール
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="aspect-[4/5] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        本が登録されていません
      </p>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {books.map((book) => (
          <BookCard key={book.bookId} book={book} onClick={onClickBook} />
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {isLoadingMore && (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          )}
        </div>
      )}
    </>
  )
}
