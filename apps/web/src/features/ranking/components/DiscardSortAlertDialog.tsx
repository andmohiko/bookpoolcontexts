import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDiscardSortMutation } from '@/features/ranking/hooks/useDiscardSortMutation'

type DiscardSortAlertDialogProps = {
  isOpen: boolean
  onClose: () => void
}

export const DiscardSortAlertDialog = ({
  isOpen,
  onClose,
}: DiscardSortAlertDialogProps) => {
  const { discard, isDiscarding } = useDiscardSortMutation()

  const handleDiscard = async (): Promise<void> => {
    try {
      await discard()
      onClose()
    } catch {
      // トースト通知はフック内で行うため握りつぶす
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ソートを破棄</DialogTitle>
          <DialogDescription>
            進行中のソートの回答をすべて破棄しますか？すでに確定しているランキングは残ります。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDiscard()}
            disabled={isDiscarding}
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
          >
            {isDiscarding ? '破棄中...' : '破棄する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
