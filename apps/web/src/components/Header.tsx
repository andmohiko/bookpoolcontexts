import { Link } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[var(--header-bg)] backdrop-blur-sm">
      <div className="flex items-center gap-4 px-4 py-3">
        <SidebarTrigger />
        <Link to="/" className="shrink-0 text-sm font-semibold text-foreground no-underline hover:text-foreground">
          BookPoolContexts
        </Link>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings">
            <Settings className="size-5" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
