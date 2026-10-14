import type { Book } from '@bookpoolcontexts/common'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type RebuildRankingAlertDialogProps = {
  isOpen: boolean
  onClose: () => void
  targetBooks: Array<Book>
  maxComparisons: number
  isStarting: boolean
  onConfirm: () => Promise<void>
}

export const RebuildRankingAlertDialog = ({
  isOpen,
  onClose,
  targetBooks,
  maxComparisons,
  isStarting,
  onConfirm,
}: RebuildRankingAlertDialogProps) => {
  const handleConfirm = async (): Promise<void> => {
    try {
      await onConfirm()
      onClose()
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ランキングを作り直す</DialogTitle>
          <DialogDescription>
            未読の本 {targetBooks.length} 冊すべてを対象に、最初から 2
            択で並び替えます。最大 {maxComparisons}{' '}
            回の比較が必要です。新しいソートが完了するまで、今のランキングは残ります。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={isStarting || targetBooks.length < 2}
          >
            {isStarting ? '開始中...' : '作り直す'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
