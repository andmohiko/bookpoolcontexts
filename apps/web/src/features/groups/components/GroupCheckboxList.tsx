import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useGroups } from '@/features/groups/hooks/useGroups'

type GroupCheckboxListProps = {
  selectedGroupIds: string[]
  onChange: (groupIds: string[]) => void
}

export const GroupCheckboxList = ({
  selectedGroupIds,
  onChange,
}: GroupCheckboxListProps) => {
  const { groups, isLoading } = useGroups()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {['1st', '2nd'].map((position) => (
          <Skeleton key={`skeleton-${position}`} className="h-6 w-32" />
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">グループがありません</p>
    )
  }

  const toggleGroup = (groupId: string): void => {
    if (selectedGroupIds.includes(groupId)) {
      onChange(selectedGroupIds.filter((id) => id !== groupId))
    } else {
      onChange([...selectedGroupIds, groupId])
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {groups.map((group) => (
        <label
          key={group.groupId}
          htmlFor={`group-checkbox-${group.groupId}`}
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox
            id={`group-checkbox-${group.groupId}`}
            checked={selectedGroupIds.includes(group.groupId)}
            onCheckedChange={() => toggleGroup(group.groupId)}
          />
          {group.label}
        </label>
      ))}
    </div>
  )
}
