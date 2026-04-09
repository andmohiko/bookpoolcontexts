import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { z } from 'zod'
import type { Book } from '@bookpoolcontexts/common'
import { Button } from '@/components/ui/button'
import { BookEditModal } from '@/features/books/components/BookEditModal'
import { BookList } from '@/features/books/components/BookList'
import { BookRegistrationModal } from '@/features/books/components/BookRegistrationModal'
import { useTags } from '@/features/tags/hooks/useTags'
import { useDisclosure } from '@/hooks/useDisclosure'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'

export const Route = createFileRoute('/_authed/')({
  validateSearch: z.object({ tag: z.string().optional(), group: z.string().optional() }),
  component: HomePage,
})

function HomePage() {
  const { tag, group } = Route.useSearch()
  const { tags } = useTags()
  const { isOpen: isCreateOpen, open: openCreate, close: closeCreate } = useDisclosure()
  const { isOpen: isEditOpen, open: openEdit, close: closeEdit } = useDisclosure()
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)

  useKeyboardShortcut(
    'c',
    useCallback(
      (e) => {
        if (isCreateOpen) return
        e.preventDefault()
        openCreate()
      },
      [isCreateOpen, openCreate],
    ),
  )

  const handleClickBook = (book: Book): void => {
    setSelectedBook(book)
    openEdit()
  }

  const handleCreateSuccess = (): void => {
    closeCreate()
  }

  const handleEditSuccess = (): void => {
    closeEdit()
    setSelectedBook(null)
  }

  const handleEditClose = (): void => {
    closeEdit()
    setSelectedBook(null)
  }

  return (
    <main className="pb-8 pt-4">
      {!group && (
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
      )}

      <BookList tag={tag} group={group} onClickBook={handleClickBook} />

      <Button
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        onClick={openCreate}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <BookRegistrationModal
        isOpen={isCreateOpen}
        onClose={closeCreate}
        onSuccess={handleCreateSuccess}
      />

      {selectedBook && (
        <BookEditModal
          isOpen={isEditOpen}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
          book={selectedBook}
        />
      )}
    </main>
  )
}
