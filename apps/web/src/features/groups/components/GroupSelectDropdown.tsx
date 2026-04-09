import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useGroups } from '@/features/groups/hooks/useGroups'

type GroupSelectDropdownProps = {
  selectedGroups: string[]
  onChange: (groups: string[]) => void
}

export const GroupSelectDropdown = ({
  selectedGroups,
  onChange,
}: GroupSelectDropdownProps) => {
  const { groups, isLoading } = useGroups()

  if (isLoading) {
    return <Skeleton className="h-8 w-40" />
  }

  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">グループがありません</p>
    )
  }

  const handleValueChange = (label: string): void => {
    if (selectedGroups.includes(label)) {
      onChange(selectedGroups.filter((g) => g !== label))
    } else {
      onChange([...selectedGroups, label])
    }
  }

  return (
    <div className="space-y-2">
      <Select onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="グループを選択" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectItem key={group.groupId} value={group.label}>
              {selectedGroups.includes(group.label) ? `✓ ${group.label}` : group.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedGroups.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs"
            >
              {label}
              <button
                type="button"
                onClick={() => onChange(selectedGroups.filter((g) => g !== label))}
                className="ml-0.5 rounded-full hover:bg-muted"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
