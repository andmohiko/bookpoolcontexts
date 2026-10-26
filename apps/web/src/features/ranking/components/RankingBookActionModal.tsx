import type { Book, Ranking } from '@bookpoolcontexts/common'
import { BookOpenCheck, Ban } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExcludeFromRankingAlertDialog } from '@/features/ranking/components/ExcludeFromRankingAlertDialog'
import { useMarkBookAsReadMutation } from '@/features/ranking/hooks/useMarkBookAsReadMutation'
import { useDisclosure } from '@/hooks/useDisclosure'

type RankingBookActionModalProps = {
  isOpen: boolean
  onClose: () => void
  book: Book
  rank: number
  ranking: Ranking | null
  /** ソート進行中は除外できない（進捗が巻き戻って見えるため） */
  canExclude: boolean
}

/**
 * ランキングの本をクリックしたときのアクションモーダル。
 *
 * ランキングからの除外と読了の2操作のみを提供する。
 * 本の内容の編集は本の一覧（BookEditModal）で行う。
 */
export const RankingBookActionModal = ({
  isOpen,
  onClose,
  book,
  rank,
  ranking,
  canExclude,
}: RankingBookActionModalProps) => {
  const { markAsRead, isMarking } = useMarkBookAsReadMutation()
  const excludeDisclosure = useDisclosure()

  const handleMarkAsRead = async (): Promise<void> => {
    try {
      await markAsRead(book.bookId)
      onClose()
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ランキング {rank} 位の本</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
            {book.coverImageUrl ? (
              <img
                src={book.coverImageUrl}
                alt={book.title ?? ''}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">No Image</span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium">
              {book.title ?? 'タイトル未取得'}
            </span>
            {book.author && (
              <span className="text-xs text-muted-foreground">
                {book.author}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleMarkAsRead()}
            disabled={isMarking}
          >
            <BookOpenCheck className="size-4" />
            {isMarking ? '更新中...' : '読了にする'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={excludeDisclosure.open}
            disabled={!canExclude}
            className="text-destructive hover:text-destructive"
          >
            <Ban className="size-4" />
            ランキングから除外
          </Button>
          {!canExclude && (
            <p className="text-xs text-muted-foreground">
              ソート中は除外できません。ソートを完了または破棄してください。
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            閉じる
          </Button>
        </DialogFooter>

        {excludeDisclosure.isOpen && (
          <ExcludeFromRankingAlertDialog
            isOpen={excludeDisclosure.isOpen}
            onClose={excludeDisclosure.close}
            onSuccess={() => {
              excludeDisclosure.close()
              onClose()
            }}
            book={book}
            ranking={ranking}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
