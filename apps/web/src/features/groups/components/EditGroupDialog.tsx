import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Group } from '@bookpoolcontexts/common'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateGroupMutation } from '@/features/groups/hooks/useUpdateGroupMutation'

const editGroupSchema = z.object({
  label: z.string().min(1, 'グループ名は必須です').max(100),
})

type EditGroupFormValues = z.infer<typeof editGroupSchema>

type EditGroupDialogProps = {
  isOpen: boolean
  onClose: () => void
  group: Group
}

export const EditGroupDialog = ({
  isOpen,
  onClose,
  group,
}: EditGroupDialogProps) => {
  const { updateGroup, isUpdating } = useUpdateGroupMutation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditGroupFormValues>({
    resolver: zodResolver(editGroupSchema),
    defaultValues: { label: group.label },
  })

  useEffect(() => {
    if (isOpen) {
      reset({ label: group.label })
    }
  }, [isOpen, group.label, reset])

  const onSubmit = async (data: EditGroupFormValues): Promise<void> => {
    await updateGroup(group.groupId, data)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>グループを編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-label">グループ名 *</Label>
            <Input id="edit-label" {...register('label')} />
            {errors.label && (
              <p className="text-xs text-destructive">
                {errors.label.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
