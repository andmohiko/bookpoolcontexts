import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { normalizeTagLabel } from '@bookpoolcontexts/common'
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
import { GroupSelectDropdown } from '@/features/groups/components/GroupSelectDropdown'
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
  onSuccess: () => void
}

export const BookRegistrationModal = ({
  isOpen,
  onClose,
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
      amazonUrl: '',
      amazonHtml: '',
      tags: [],
      foundBy: '',
      location: '',
      purchasedBy: [],
      groups: [],
      note: '',
      isRead: false,
    },
  })

  const tags = watch('tags')
  const purchasedBy = watch('purchasedBy')
  const groups = watch('groups')
  const isRead = watch('isRead')

  useEffect(() => {
    if (isOpen) {
      reset({
        amazonUrl: '',
        amazonHtml: '',
        tags: [],
        foundBy: '',
        location: '',
        purchasedBy: [],
        groups: [],
        note: '',
        isRead: false,
      })
      setTagInput('')
    }
  }, [isOpen, reset])

  const onSubmit = async (data: BookRegistrationFormValues): Promise<void> => {
    await createBook(data)
    onSuccess()
  }

  const addTag = (label: string): void => {
    const normalized = normalizeTagLabel(label)
    if (normalized && !tags.includes(normalized)) {
      setValue('tags', [...tags, normalized])
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
      <DialogContent
        className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg md:max-w-2xl lg:max-w-3xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          setTimeout(() => {
            document.getElementById('amazonUrl')?.focus()
          }, 0)
        }}
      >
        <DialogHeader>
          <DialogTitle>本を登録</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amazonUrl">AmazonのURL</Label>
              <Input
                id="amazonUrl"
                placeholder="https://www.amazon.co.jp/dp/..."
                {...register('amazonUrl')}
              />
              {errors.amazonUrl && (
                <p className="text-xs text-destructive">{errors.amazonUrl.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                URL または下のHTMLのいずれかを入力してください
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amazonHtml">Amazon詳細ページのHTML（任意）</Label>
              <Textarea
                id="amazonHtml"
                placeholder="スクレイピングが失敗する場合、Amazon詳細ページを開いて右クリック→ページのソース表示からHTMLをコピーして貼り付け"
                rows={10}
                className="[field-sizing:fixed] w-full max-w-full max-h-60 resize-none overflow-auto whitespace-pre"
                {...register('amazonHtml')}
              />
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
              <Label>グループ</Label>
              <GroupSelectDropdown
                selectedGroups={groups}
                onChange={(labels) => setValue('groups', labels)}
              />
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

            <div className="space-y-2">
              <Label>読了状態</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={isRead}
                  onCheckedChange={(v) => setValue('isRead', v === true)}
                />
                読み終わった
              </label>
            </div>
          </div>

          <DialogFooter className="pt-4">
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
