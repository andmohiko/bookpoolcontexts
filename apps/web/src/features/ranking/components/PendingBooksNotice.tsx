import type { Book } from '@bookpoolcontexts/common'
import dayjs from 'dayjs'
import { ChevronRight } from 'lucide-react'

import type { DuplicateBook } from '@/features/ranking/hooks/useUnreadBooks'

type PendingBooksNoticeProps = {
  /** タイトル未取得でランキング対象外になった本 */
  pendingBooks: Array<Book>
  /** 同じ本の重複登録として除外した本 */
  duplicateBooks: Array<DuplicateBook>
}

const BookRow = ({ book }: { book: Book }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
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
      <span className="line-clamp-2 text-sm">
        {book.title ?? 'タイトル未取得'}
      </span>
      <a
        href={book.amazonUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="line-clamp-1 break-all text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {book.amazonUrl}
      </a>
    </div>
  </div>
)

/**
 * ランキング対象から外した本を理由ごとに表示する。
 *
 * 件数だけでは「どの本が除かれたか」が分からず、重複を整理できないため、
 * 折りたたみの中に実際の本を出す。
 */
export const PendingBooksNotice = ({
  pendingBooks,
  duplicateBooks,
}: PendingBooksNoticeProps) => {
  if (pendingBooks.length === 0 && duplicateBooks.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {pendingBooks.length > 0 && (
        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
            <span className="text-muted-foreground">
              情報の取得が終わっていない本 ({pendingBooks.length})
            </span>
          </summary>
          <div className="flex flex-col gap-3 border-t p-3">
            <p className="text-xs text-muted-foreground">
              タイトルが取得できていないため対象から外しています。取得が完了すると「ランキング未追加の本」に表示され、「ランキングを更新」で組み込めます。
            </p>
            {pendingBooks.map((book) => (
              <BookRow key={book.bookId} book={book} />
            ))}
          </div>
        </details>
      )}

      {duplicateBooks.length > 0 && (
        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
            <span className="text-muted-foreground">
              重複として除外した本 ({duplicateBooks.length})
            </span>
          </summary>
          <div className="flex flex-col gap-3 border-t p-3">
            <p className="text-xs text-muted-foreground">
              同じ本が複数登録されているため、先に登録された 1
              冊だけを対象にしています。不要な方はホーム画面から削除できます。
            </p>
            {duplicateBooks.map(({ book, keptBook }) => (
              <div key={book.bookId} className="flex flex-col gap-1.5">
                <BookRow book={book} />
                <span className="pl-12 text-xs text-muted-foreground">
                  「{keptBook.title}」（
                  {dayjs(keptBook.createdAt).format('YYYY/M/D')}
                  登録）と同じ本として扱いました
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
