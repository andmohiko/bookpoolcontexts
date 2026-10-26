import type { Book, Ranking } from '@bookpoolcontexts/common'
import { useState } from 'react'

import { RankingBookActionModal } from '@/features/ranking/components/RankingBookActionModal'
import { RankingListItem } from '@/features/ranking/components/RankingListItem'

type RankingListProps = {
  books: Array<Book>
  ranking: Ranking | null
  /** ソート進行中は除外できない（進捗が巻き戻って見えるため） */
  canExclude: boolean
}

/** アクションモーダルで操作中の本と、その順位 */
type SelectedBook = {
  book: Book
  rank: number
}

export const RankingList = ({
  books,
  ranking,
  canExclude,
}: RankingListProps) => {
  const [selected, setSelected] = useState<SelectedBook | null>(null)

  if (books.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        表示できる本がありません。読了・削除した本はランキングから外れます。
      </p>
    )
  }

  return (
    <>
      <ol className="flex flex-col gap-2">
        {books.map((book, index) => (
          <RankingListItem
            key={book.bookId}
            book={book}
            rank={index + 1}
            onClick={(clickedBook, rank) =>
              setSelected({ book: clickedBook, rank })
            }
          />
        ))}
      </ol>

      {selected && (
        <RankingBookActionModal
          isOpen
          onClose={() => setSelected(null)}
          book={selected.book}
          rank={selected.rank}
          ranking={ranking}
          canExclude={canExclude}
        />
      )}
    </>
  )
}
