import { createFileRoute } from '@tanstack/react-router'
import { GroupList } from '@/features/groups/components/GroupList'

export const Route = createFileRoute('/_authed/groups')({
  component: GroupsPage,
})

function GroupsPage() {
  return (
    <main className="pb-8 pt-4">
      <h1 className="mb-6 text-xl font-semibold">グループ管理</h1>
      <GroupList />
    </main>
  )
}
