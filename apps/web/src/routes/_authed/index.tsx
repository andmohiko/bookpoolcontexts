import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="pb-8 pt-4">
      <p className="text-muted-foreground">本の一覧（実装予定）</p>
    </main>
  )
}
