import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
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
import { useCreateBookMutation } from '@/features/books/hooks/useCreateBookMutation'
import {
  bookRegistrationSchema,
  type BookRegistrationFormValues,
} from '@/features/books/schemas/bookSchema'

const PURCHASED_BY_OPTIONS = ['物理本', 'Kindle', 'オフィス'] as const

type BookRegistrationModalProps = {
  isOpen: boolean
  onClose: () => void
  defaultValues: Partial<BookRegistrationFormValues>
  onSuccess: () => void
}

export const BookRegistrationModal = ({
  isOpen,
  onClose,
  defaultValues,
  onSuccess,
}: BookRegistrationModalProps) => {
  const { createBook, isCreating } = useCreateBookMutation()
  const [tagInput, setTagInput] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookRegistrationFormValues>({
    resolver: zodResolver(bookRegistrationSchema),
    defaultValues: {
      title: '',
      coverImageUrl: '',
      amazonUrl: '',
      tags: [],
      foundBy: '',
      location: '',
      purchasedBy: [],
      groups: [],
      note: '',
    },
  })

  const tags = watch('tags')
  const purchasedBy = watch('purchasedBy')

  useEffect(() => {
    if (isOpen) {
      reset({
        title: defaultValues.title ?? '',
        coverImageUrl: defaultValues.coverImageUrl ?? '',
        amazonUrl: defaultValues.amazonUrl ?? '',
        tags: [],
        foundBy: '',
        location: '',
        purchasedBy: [],
        groups: [],
        note: '',
      })
      setTagInput('')
    }
  }, [isOpen, defaultValues, reset])

  const onSubmit = async (data: BookRegistrationFormValues): Promise<void> => {
    await createBook(data)
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
          <DialogTitle>本を登録</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {defaultValues.coverImageUrl && (
            <div className="flex justify-center">
              <img
                src={defaultValues.coverImageUrl}
                alt={defaultValues.title}
                className="h-32 rounded-md object-cover"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">タイトル *</Label>
            <Input id="title" {...register('title')} />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

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
            <Label htmlFor="foundBy">どこで見つけたか</Label>
            <Input
              id="foundBy"
              placeholder="SNS、友人の推薦、書店で見かけたなど"
              {...register('foundBy')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">どこで読めるか</Label>
            <Input
              id="location"
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
            <Label htmlFor="note">メモ</Label>
            <Textarea
              id="note"
              placeholder="なぜこの本を読みたいか、期待することなど"
              rows={3}
              {...register('note')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? '登録中...' : '登録'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
