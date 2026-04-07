import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import type { Book } from '@bookpoolcontexts/common'
import { Button } from '@/components/ui/button'
import { BookList } from '@/features/books/components/BookList'
import { useTags } from '@/features/tags/hooks/useTags'

export const Route = createFileRoute('/_authed/')({
  validateSearch: z.object({ tag: z.string().optional() }),
  component: HomePage,
})

function HomePage() {
  const { tag } = Route.useSearch()
  const { tags } = useTags()
  const navigate = useNavigate()

  const handleClickBook = (book: Book): void => {
    navigate({ to: '/book/$bookId', params: { bookId: book.bookId } })
  }

  return (
    <main className="pb-8 pt-4">
      <nav className="mb-4 flex gap-2 overflow-x-auto">
        <Link
          to="/"
          search={{}}
          className={`shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
            !tag
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-accent'
          }`}
        >
          すべて
        </Link>
        {tags.map((t) => (
          <Link
            key={t.tagId}
            to="/"
            search={{ tag: t.label }}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
              tag === t.label
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-accent'
            }`}
          >
            #{t.label}
          </Link>
        ))}
      </nav>

      <BookList tag={tag} onClickBook={handleClickBook} />

      <Button
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        onClick={() => navigate({ to: '/new' })}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </main>
  )
}
