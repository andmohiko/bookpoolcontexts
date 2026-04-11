import type { Tag } from '@bookpoolcontexts/common'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeleteTagMutation } from '@/features/tags/hooks/useDeleteTagMutation'

type DeleteTagAlertDialogProps = {
  isOpen: boolean
  onClose: () => void
  tag: Tag
}

export const DeleteTagAlertDialog = ({
  isOpen,
  onClose,
  tag,
}: DeleteTagAlertDialogProps) => {
  const { deleteTag, isDeleting } = useDeleteTagMutation()

  const handleDelete = async (): Promise<void> => {
    await deleteTag(tag.tagId)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>タグを削除</DialogTitle>
          <DialogDescription>
            「{tag.label}」を削除しますか？
            {tag.count > 0 && (
              <>
                このタグは{tag.count}
                冊の本に付いています。本自体は削除されませんが、タグの紐付けが解除されます。
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
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
          >
            {isDeleting ? '削除中...' : '削除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
