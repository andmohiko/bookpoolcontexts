import { useState } from 'react'
import type { Tag } from '@bookpoolcontexts/common'
import { Pencil, TagIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DeleteTagAlertDialog } from '@/features/tags/components/DeleteTagAlertDialog'
import { EditTagDialog } from '@/features/tags/components/EditTagDialog'
import { useTags } from '@/features/tags/hooks/useTags'
import { useDisclosure } from '@/hooks/useDisclosure'

export const TagList = () => {
  const { tags, isLoading } = useTags()
  const editDisclosure = useDisclosure()
  const deleteDisclosure = useDisclosure()
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)

  const handleEdit = (tag: Tag): void => {
    setSelectedTag(tag)
    editDisclosure.open()
  }

  const handleDelete = (tag: Tag): void => {
    setSelectedTag(tag)
    deleteDisclosure.open()
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <>
      {tags.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          タグがありません。本を登録する際にタグを追加すると、ここに表示されます。
        </p>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <Card
              key={tag.tagId}
              className="flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{tag.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {tag.count}冊
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(tag)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(tag)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedTag && (
        <>
          <EditTagDialog
            isOpen={editDisclosure.isOpen}
            onClose={editDisclosure.close}
            tag={selectedTag}
          />
          <DeleteTagAlertDialog
            isOpen={deleteDisclosure.isOpen}
            onClose={deleteDisclosure.close}
            tag={selectedTag}
          />
        </>
      )}
    </>
  )
}
