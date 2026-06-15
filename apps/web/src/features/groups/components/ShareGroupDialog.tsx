import type { Group, SharedGroup } from '@bookpoolcontexts/common'
import { Copy, LinkIcon, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCreateSharedGroupMutation } from '@/features/groups/hooks/useCreateSharedGroupMutation'
import { useDeleteSharedGroupMutation } from '@/features/groups/hooks/useDeleteSharedGroupMutation'

type ShareGroupDialogProps = {
  isOpen: boolean
  onClose: () => void
  group: Group
  sharedGroup: SharedGroup | null
}

export const ShareGroupDialog = ({
  isOpen,
  onClose,
  group,
  sharedGroup,
}: ShareGroupDialogProps) => {
  const { createSharedGroup, isCreating } = useCreateSharedGroupMutation()
  const { deleteSharedGroup, isDeleting } = useDeleteSharedGroupMutation()

  const shareUrl = sharedGroup
    ? `${window.location.origin}/shared/${sharedGroup.sharedGroupId}`
    : ''

  const handleCreate = async (): Promise<void> => {
    await createSharedGroup(group)
    onClose()
  }

  const handleCopyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(shareUrl)
    toast.success('リンクをコピーしました')
  }

  const handleUnshare = async (): Promise<void> => {
    if (!sharedGroup) return
    await deleteSharedGroup(sharedGroup.sharedGroupId)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>グループを共有</DialogTitle>
          <DialogDescription>「{group.label}」の共有設定</DialogDescription>
        </DialogHeader>

        {sharedGroup ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                このグループは共有されています。リンクを知っている人は誰でも閲覧できます。
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="bg-muted flex-1 truncate rounded-md border px-3 py-2 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="destructive"
                onClick={handleUnshare}
                disabled={isDeleting}
                className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
              >
                <Unlink className="mr-2 h-4 w-4" />
                {isDeleting ? '解除中...' : '共有を解除'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                閉じる
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              共有リンクを生成すると、リンクを知っている人は誰でもこのグループの本一覧を閲覧できます。表示される情報はタイトル・著者・表紙画像・タグのみです。
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                <LinkIcon className="mr-2 h-4 w-4" />
                {isCreating ? '作成中...' : '共有リンクを生成'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
