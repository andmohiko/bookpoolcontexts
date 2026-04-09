import { Link, useSearch } from '@tanstack/react-router'
import { DownloadIcon, FolderOpen, Settings2, TagIcon } from 'lucide-react'
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
import { useGroups } from '@/features/groups/hooks/useGroups'
import { useTags } from '@/features/tags/hooks/useTags'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export const SideNav = () => {
  const { tags, isLoading: isLoadingTags } = useTags()
  const { groups, isLoading: isLoadingGroups } = useGroups()
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

              {isLoadingTags
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

        <SidebarGroup>
          <SidebarGroupLabel>グループ</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {isLoadingGroups
                ? Array.from({ length: 3 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton />
                    </SidebarMenuItem>
                  ))
                : groups.map((group) => (
                    <SidebarMenuItem key={group.groupId}>
                      <SidebarMenuButton tooltip={group.label}>
                        <FolderOpen />
                        <span>{group.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>{group.count}</SidebarMenuBadge>
                    </SidebarMenuItem>
                  ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="グループ管理">
                  <Link to="/groups">
                    <Settings2 />
                    <span>グループ管理</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
