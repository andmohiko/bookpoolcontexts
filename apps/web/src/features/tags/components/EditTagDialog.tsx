import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Tag } from '@bookpoolcontexts/common'
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
import { useUpdateTagMutation } from '@/features/tags/hooks/useUpdateTagMutation'

const editTagSchema = z.object({
  label: z.string().min(1, 'タグ名は必須です').max(50, 'タグ名は50文字以下にしてください'),
})

type EditTagFormValues = z.infer<typeof editTagSchema>

type EditTagDialogProps = {
  isOpen: boolean
  onClose: () => void
  tag: Tag
}

export const EditTagDialog = ({ isOpen, onClose, tag }: EditTagDialogProps) => {
  const { updateTag, isUpdating } = useUpdateTagMutation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTagFormValues>({
    resolver: zodResolver(editTagSchema),
    defaultValues: { label: tag.label },
  })

  useEffect(() => {
    if (isOpen) {
      reset({ label: tag.label })
    }
  }, [isOpen, tag.label, reset])

  const onSubmit = async (data: EditTagFormValues): Promise<void> => {
    await updateTag({ oldLabel: tag.label, newLabel: data.label })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>タグを編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-tag-label">タグ名 *</Label>
            <Input id="edit-tag-label" {...register('label')} />
            {errors.label && (
              <p className="text-xs text-destructive">{errors.label.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {tag.count}冊の本のタグが更新されます
            </p>
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
