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
import { useDeleteBookMutation } from '@/features/books/hooks/useDeleteBookMutation'

type DeleteBookAlertDialogProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  book: Book
}

export const DeleteBookAlertDialog = ({
  isOpen,
  onClose,
  onSuccess,
  book,
}: DeleteBookAlertDialogProps) => {
  const { deleteBook, isDeleting } = useDeleteBookMutation()

  const handleDelete = async (): Promise<void> => {
    await deleteBook(book.bookId)
    onSuccess()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>本を削除</DialogTitle>
          <DialogDescription>
            {book.title ? `「${book.title}」` : 'この本'}
            を削除しますか？この操作は取り消せません。
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
