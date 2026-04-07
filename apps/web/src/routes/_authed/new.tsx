import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useState } from 'react'
import type { AmazonBookItem } from '@bookpoolcontexts/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookRegistrationModal } from '@/features/books/components/BookRegistrationModal'
import { BookSearchResultGrid } from '@/features/books/components/BookSearchResultGrid'
import { useSearchBooks } from '@/features/books/hooks/useSearchBooks'
import { useDisclosure } from '@/hooks/useDisclosure'

export const Route = createFileRoute('/_authed/new')({
  component: NewBookPage,
})

function NewBookPage() {
  const navigate = useNavigate()
  const { results, isSearching, error, search } = useSearchBooks()
  const { isOpen, open, close } = useDisclosure()
  const [keyword, setKeyword] = useState('')
  const [selectedBook, setSelectedBook] = useState<AmazonBookItem | null>(null)

  const handleSearch = async (): Promise<void> => {
    if (!keyword.trim()) return
    await search(keyword)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleSelect = (item: AmazonBookItem): void => {
    setSelectedBook(item)
    open()
  }

  const handleSuccess = (): void => {
    close()
    navigate({ to: '/' })
  }

  return (
    <main className="pb-8 pt-4">
      <h1 className="mb-6 text-xl font-semibold">本を登録</h1>

      <div className="mb-6 flex gap-2">
        <Input
          placeholder="タイトルで検索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button onClick={handleSearch} disabled={isSearching || !keyword.trim()}>
          <Search className="mr-1 h-4 w-4" />
          検索
        </Button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      {!isSearching && results.length === 0 && keyword && !error && (
        <p className="mb-4 text-sm text-muted-foreground">
          検索結果がありません
        </p>
      )}

      <BookSearchResultGrid
        items={results}
        isLoading={isSearching}
        onSelect={handleSelect}
      />

      {selectedBook && (
        <BookRegistrationModal
          isOpen={isOpen}
          onClose={close}
          defaultValues={{
            title: selectedBook.title,
            coverImageUrl: selectedBook.coverImageUrl,
            amazonUrl: selectedBook.amazonUrl,
          }}
          onSuccess={handleSuccess}
        />
      )}
    </main>
  )
}
