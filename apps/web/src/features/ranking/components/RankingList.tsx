import type { Book } from '@bookpoolcontexts/common'

import { RankingListItem } from '@/features/ranking/components/RankingListItem'

type RankingListProps = {
  books: Array<Book>
}

export const RankingList = ({ books }: RankingListProps) => {
  if (books.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        表示できる本がありません。読了・削除した本はランキングから外れます。
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-2">
      {books.map((book, index) => (
        <RankingListItem key={book.bookId} book={book} rank={index + 1} />
      ))}
    </ol>
  )
}
