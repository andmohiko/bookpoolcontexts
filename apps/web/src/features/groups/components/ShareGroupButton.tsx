import type { Group } from '@bookpoolcontexts/common'
import { Link2, Share2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { ShareGroupDialog } from '@/features/groups/components/ShareGroupDialog'
import { useSharedGroups } from '@/features/groups/hooks/useSharedGroups'
import { useDisclosure } from '@/hooks/useDisclosure'

type ShareGroupButtonProps = {
  group: Group
  size?: ComponentProps<typeof Button>['size']
}

/**
 * グループの共有ダイアログを開くボタン。
 * 共有済みかどうかで見た目を切り替える（共有済み: 🔗 / 未共有: 共有アイコン）。
 */
export const ShareGroupButton = ({
  group,
  size = 'sm',
}: ShareGroupButtonProps) => {
  const { sharedGroups } = useSharedGroups()
  const { isOpen, open, close } = useDisclosure()

  const sharedGroup =
    sharedGroups.find((sg) => sg.groupId === group.groupId) ?? null
  const isShared = sharedGroup !== null

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        onClick={open}
        aria-label={isShared ? '共有リンクをコピー' : 'グループを共有'}
        title={isShared ? '共有中' : 'グループを共有'}
        className={isShared ? 'text-primary' : ''}
      >
        {isShared ? (
          <Link2 className="h-4 w-4" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
      </Button>

      <ShareGroupDialog
        isOpen={isOpen}
        onClose={close}
        group={group}
        sharedGroup={sharedGroup}
      />
    </>
  )
}
