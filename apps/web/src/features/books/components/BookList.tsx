import type { Book } from '@bookpoolcontexts/common'
import { Skeleton } from '@/components/ui/skeleton'
import { BookCard } from '@/features/books/components/BookCard'
import { useBooks } from '@/features/books/hooks/useBooks'
import { useHideReadBooks } from '@/hooks/useHideReadBooks'

type BookListProps = {
  tag?: string
  group?: string
  onClickBook: (book: Book) => void
}

export const BookList = ({ tag, group, onClickBook }: BookListProps) => {
  const { books, isLoading } = useBooks({ tag, group })
  const { hideReadBooks } = useHideReadBooks()

  const visibleBooks = hideReadBooks
    ? books.filter((b) => !b.isRead)
    : books

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={`skeleton-${i.toString()}`}
            className="aspect-[4/5] w-full rounded-lg"
          />
        ))}
      </div>
    )
  }

  if (visibleBooks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        本が登録されていません
      </p>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {visibleBooks.map((book) => (
        <BookCard key={book.bookId} book={book} onClick={onClickBook} />
      ))}
    </div>
  )
}
