import type { Book, Ranking } from '@bookpoolcontexts/common'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useExcludeBookMutation } from '@/features/ranking/hooks/useExcludeBookMutation'

type ExcludeFromRankingAlertDialogProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  book: Book
  ranking: Ranking | null
}

export const ExcludeFromRankingAlertDialog = ({
  isOpen,
  onClose,
  onSuccess,
  book,
  ranking,
}: ExcludeFromRankingAlertDialogProps) => {
  const { exclude, isExcluding } = useExcludeBookMutation(ranking)

  const handleExclude = async (): Promise<void> => {
    try {
      await exclude(book.bookId)
      onSuccess()
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ランキングから除外</DialogTitle>
          <DialogDescription>
            {book.title ? `「${book.title}」` : 'この本'}
            をランキングから除外しますか？除外した本は作り直し・更新のいずれでも対象外になります。「除外した本」から解除できます。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleExclude()}
            disabled={isExcluding}
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
          >
            {isExcluding ? '除外中...' : '除外する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
