import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SharedBookCard } from '@/features/shared/components/SharedBookCard'
import { useSharedGroup } from '@/features/shared/hooks/useSharedGroup'

export const Route = createFileRoute('/shared/$sharedGroupId')({
  component: SharedGroupPage,
})

function SharedGroupPage() {
  const { sharedGroupId } = Route.useParams()
  const { sharedGroup, isLoading } = useSharedGroup(sharedGroupId)

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
        <SharedHeader />
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {['1st', '2nd', '3rd', '4th', '5th', '6th'].map((position) => (
            <Skeleton
              key={`skeleton-${position}`}
              className="aspect-[4/5] w-full rounded-lg"
            />
          ))}
        </div>
      </main>
    )
  }

  if (!sharedGroup) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
        <SharedHeader />
        <div className="flex flex-col items-center gap-4 py-24">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">
            このページは公開されていません
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <SharedHeader />
      <h1 className="mb-6 text-2xl font-bold">
        {sharedGroup.ownerName
          ? `${sharedGroup.ownerName} の ${sharedGroup.groupLabel}`
          : sharedGroup.groupLabel}
      </h1>
      {sharedGroup.books.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          このグループにはまだ本が登録されていません
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {/* SharedBook に ID はないため amazonUrl をキーにする。
              スナップショットの読み取り専用表示で並べ替えも削除もしない */}
          {sharedGroup.books.map((book) => (
            <SharedBookCard key={book.amazonUrl} book={book} />
          ))}
        </div>
      )}
    </main>
  )
}

const SharedHeader = () => {
  return (
    <header className="mb-8 flex items-center justify-between">
      <h2 className="text-lg font-semibold">BookPoolContexts</h2>
      <Button asChild variant="outline" size="sm">
        <Link to="/login">このアプリを使ってみる</Link>
      </Button>
    </header>
  )
}
