import type { Group } from '@bookpoolcontexts/common'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeleteGroupMutation } from '@/features/groups/hooks/useDeleteGroupMutation'

type DeleteGroupAlertDialogProps = {
  isOpen: boolean
  onClose: () => void
  group: Group
}

export const DeleteGroupAlertDialog = ({
  isOpen,
  onClose,
  group,
}: DeleteGroupAlertDialogProps) => {
  const { deleteGroup, isDeleting } = useDeleteGroupMutation()

  const handleDelete = async (): Promise<void> => {
    await deleteGroup(group.groupId)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>グループを削除</DialogTitle>
          <DialogDescription>
            「{group.label}」を削除しますか？
            {group.count > 0 && (
              <>
                このグループには{group.count}
                冊の本が登録されています。本自体は削除されませんが、グループの紐付けが解除されます。
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? '削除中...' : '削除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
