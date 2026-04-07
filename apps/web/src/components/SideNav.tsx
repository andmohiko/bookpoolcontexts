import { Link, useSearch } from '@tanstack/react-router'
import { DownloadIcon, TagIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useTags } from '@/features/tags/hooks/useTags'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export const SideNav = () => {
  const { tags, isLoading } = useTags()
  const search = useSearch({ strict: false }) as { tag?: string }
  const selectedTag = search.tag ?? null
  const { canInstall, promptInstall } = usePWAInstall()

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>タグ</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={selectedTag === null}
                  tooltip="すべて"
                  className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90"
                >
                  <Link to="/" search={{}}>
                    <TagIcon />
                    <span>すべて</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton />
                    </SidebarMenuItem>
                  ))
                : tags.map((tag) => (
                    <SidebarMenuItem key={tag.tagId}>
                      <SidebarMenuButton
                        asChild
                        isActive={selectedTag === tag.label}
                        tooltip={tag.label}
                        className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90"
                      >
                        <Link to="/" search={{ tag: tag.label }}>
                          <TagIcon />
                          <span>{tag.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>{tag.count}</SidebarMenuBadge>
                    </SidebarMenuItem>
                  ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {canInstall && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={promptInstall}
                tooltip="アプリをインストール"
              >
                <DownloadIcon />
                <span>アプリをインストール</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
