import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { useRecentTags } from '@/features/tags/hooks/useRecentTags'
import { useTags } from '@/features/tags/hooks/useTags'

type TagSuggestionDropdownProps = {
  tagInput: string
  activeTags: string[]
  onSelect: (label: string) => void
}

export const TagSuggestionDropdown = ({
  tagInput,
  activeTags,
  onSelect,
}: TagSuggestionDropdownProps) => {
  const { tags: recentTags } = useRecentTags()
  const { tags: allTags } = useTags()

  const suggestions = useMemo(() => {
    if (tagInput === '') {
      return recentTags.filter((tag) => !activeTags.includes(tag.label))
    }

    const lowerInput = tagInput.toLowerCase()
    return allTags
      .filter((tag) => !activeTags.includes(tag.label))
      .filter((tag) => tag.label.toLowerCase().startsWith(lowerInput))
  }, [recentTags, allTags, tagInput, activeTags])

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {tagInput === '' ? '最近使ったタグ' : '候補'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((tag) => (
          <Badge
            key={tag.tagId}
            variant="outline"
            className="cursor-pointer hover:bg-secondary"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(tag.label)
            }}
          >
            {tag.label}
          </Badge>
        ))}
      </div>
    </div>
  )
}
