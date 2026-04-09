import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import type { Book } from '@bookpoolcontexts/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TagSuggestionDropdown } from '@/features/tags/components/TagSuggestionDropdown'
import { DeleteBookAlertDialog } from '@/features/books/components/DeleteBookAlertDialog'
import { useUpdateBookMutation } from '@/features/books/hooks/useUpdateBookMutation'
import {
  bookEditSchema,
  type BookEditFormValues,
} from '@/features/books/schemas/bookSchema'

const PURCHASED_BY_OPTIONS = ['物理本', 'Kindle', 'オフィス'] as const

type BookEditModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  book: Book
}

export const BookEditModal = ({
  isOpen,
  onClose,
  onSuccess,
  book,
}: BookEditModalProps) => {
  const { updateBook, isUpdating } = useUpdateBookMutation()
  const [tagInput, setTagInput] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<BookEditFormValues>({
    resolver: zodResolver(bookEditSchema),
    defaultValues: {
      tags: book.tags,
      foundBy: book.foundBy,
      location: book.location,
      purchasedBy: book.purchasedBy,
      groups: book.groups,
      note: book.note,
    },
  })

  const tags = watch('tags')
  const purchasedBy = watch('purchasedBy')

  useEffect(() => {
    if (isOpen) {
      reset({
        tags: book.tags,
        foundBy: book.foundBy,
        location: book.location,
        purchasedBy: book.purchasedBy,
        groups: book.groups,
        note: book.note,
      })
      setTagInput('')
    }
  }, [isOpen, book, reset])

  const onSubmit = async (data: BookEditFormValues): Promise<void> => {
    await updateBook(book.bookId, data)
    onSuccess()
  }

  const addTag = (label: string): void => {
    const trimmed = label.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setValue('tags', [...tags, trimmed])
    }
    setTagInput('')
  }

  const removeTag = (label: string): void => {
    setValue(
      'tags',
      tags.filter((t) => t !== label),
    )
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  const togglePurchasedBy = (option: string): void => {
    if (purchasedBy.includes(option)) {
      setValue(
        'purchasedBy',
        purchasedBy.filter((p) => p !== option),
      )
    } else {
      setValue('purchasedBy', [...purchasedBy, option])
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>本を編集</DialogTitle>
        </DialogHeader>

        {book.coverImageUrl && (
          <div className="flex justify-center">
            <img
              src={book.coverImageUrl}
              alt={book.title ?? ''}
              className="h-32 rounded-md object-cover"
            />
          </div>
        )}

        {book.title && (
          <p className="text-center text-sm font-medium">{book.title}</p>
        )}
        {book.author && (
          <p className="text-center text-xs text-muted-foreground">{book.author}</p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>タグ</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="タグを入力してEnterで追加"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
            <TagSuggestionDropdown
              tagInput={tagInput}
              activeTags={tags}
              onSelect={addTag}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-foundBy">どこで見つけたか</Label>
            <Input
              id="edit-foundBy"
              placeholder="SNS、友人の推薦、書店で見かけたなど"
              {...register('foundBy')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">どこで読めるか</Label>
            <Input
              id="edit-location"
              placeholder="図書館、ブックオフ、Kindle Unlimitedなど"
              {...register('location')}
            />
          </div>

          <div className="space-y-2">
            <Label>購入場所</Label>
            <div className="flex gap-4">
              {PURCHASED_BY_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={purchasedBy.includes(option)}
                    onCheckedChange={() => togglePurchasedBy(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-note">メモ</Label>
            <Textarea
              id="edit-note"
              placeholder="なぜこの本を読みたいか、期待することなど"
              rows={3}
              {...register('note')}
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              削除
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                キャンセル
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? '更新中...' : '更新'}
              </Button>
            </div>
          </DialogFooter>
        </form>

        <DeleteBookAlertDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onSuccess={() => {
            setIsDeleteDialogOpen(false)
            onClose()
          }}
          book={book}
        />
      </DialogContent>
    </Dialog>
  )
}
