import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { useCreateGroupMutation } from '@/features/groups/hooks/useCreateGroupMutation'

const createGroupSchema = z.object({
  label: z.string().min(1, 'グループ名は必須です').max(100),
})

type CreateGroupFormValues = z.infer<typeof createGroupSchema>

type CreateGroupDialogProps = {
  isOpen: boolean
  onClose: () => void
}

export const CreateGroupDialog = ({
  isOpen,
  onClose,
}: CreateGroupDialogProps) => {
  const { createGroup, isCreating } = useCreateGroupMutation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { label: '' },
  })

  const onSubmit = async (data: CreateGroupFormValues): Promise<void> => {
    await createGroup(data)
    reset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>グループを作成</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">グループ名 *</Label>
            <Input id="label" {...register('label')} />
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
            <Button type="submit" disabled={isCreating}>
              {isCreating ? '作成中...' : '作成'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
