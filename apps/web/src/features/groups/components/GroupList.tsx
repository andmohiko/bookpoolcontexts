import { useState } from 'react'
import type { Group } from '@bookpoolcontexts/common'
import { FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGroups } from '@/features/groups/hooks/useGroups'
import { useDisclosure } from '@/hooks/useDisclosure'
import { CreateGroupDialog } from '@/features/groups/components/CreateGroupDialog'
import { EditGroupDialog } from '@/features/groups/components/EditGroupDialog'
import { DeleteGroupAlertDialog } from '@/features/groups/components/DeleteGroupAlertDialog'

export const GroupList = () => {
  const { groups, isLoading } = useGroups()
  const createDisclosure = useDisclosure()
  const editDisclosure = useDisclosure()
  const deleteDisclosure = useDisclosure()
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

  const handleEdit = (group: Group): void => {
    setSelectedGroup(group)
    editDisclosure.open()
  }

  const handleDelete = (group: Group): void => {
    setSelectedGroup(group)
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
      <Button onClick={createDisclosure.open} className="mb-4" variant="outline">
        <Plus className="mr-1 h-4 w-4" />
        グループを作成
      </Button>

      {groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          グループがありません
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Card
              key={group.groupId}
              className="flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{group.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {group.count}冊
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(group)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(group)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateGroupDialog
        isOpen={createDisclosure.isOpen}
        onClose={createDisclosure.close}
      />
      {selectedGroup && (
        <>
          <EditGroupDialog
            isOpen={editDisclosure.isOpen}
            onClose={editDisclosure.close}
            group={selectedGroup}
          />
          <DeleteGroupAlertDialog
            isOpen={deleteDisclosure.isOpen}
            onClose={deleteDisclosure.close}
            group={selectedGroup}
          />
        </>
      )}
    </>
  )
}
