import { createFileRoute } from '@tanstack/react-router'
import { TagList } from '@/features/tags/components/TagList'

export const Route = createFileRoute('/_authed/tags')({
  component: TagsPage,
})

function TagsPage() {
  return (
    <main className="pb-8 pt-4">
      <h1 className="mb-6 text-xl font-semibold">タグ管理</h1>
      <TagList />
    </main>
  )
}
