import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { toast } from 'sonner'

import type { UpdateUserDto } from '@bookpoolcontexts/common'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useHideReadBooks } from '@/hooks/useHideReadBooks'
import { type ThemeMode, useThemeMode } from '@/hooks/useThemeMode'
import {
  fetchUserOperation,
  updateUserOperation,
} from '@/infrastructure/firestore/users'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
})

const themeOptions: Array<{
  value: ThemeMode
  label: string
  icon: typeof SunIcon
}> = [
  { value: 'light', label: 'ライト', icon: SunIcon },
  { value: 'dark', label: 'ダーク', icon: MoonIcon },
  { value: 'auto', label: 'デバイスに合わせる', icon: MonitorIcon },
]

const SettingsPage = () => {
  const { uid, logout } = useFirebaseAuthContext()
  const { mode, setThemeMode } = useThemeMode()
  const { hideReadBooks, setHideReadBooks } = useHideReadBooks()
  const [displayName, setDisplayName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!uid) return
    fetchUserOperation(uid).then((user) => {
      if (user?.displayName) {
        setDisplayName(user.displayName)
      }
    })
  }, [uid])

  const handleSaveDisplayName = async (): Promise<void> => {
    if (!uid) return
    setIsSaving(true)
    try {
      const dto: UpdateUserDto = {
        displayName,
        updatedAt: serverTimestamp,
      }
      await updateUserOperation(uid, dto)
      toast.success('表示名を更新しました')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="pb-8 pt-14">
      <h1 className="mb-8 text-xl font-semibold">設定</h1>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">プロフィール</h2>
        <div className="flex max-w-sm items-center gap-2">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="表示名"
          />
          <Button
            onClick={handleSaveDisplayName}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          グループ共有ページで「○○ の グループ名」のように表示されます
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">テーマ</h2>
        <div className="flex gap-2">
          {themeOptions.map((option) => (
            <Button
              key={option.value}
              variant={mode === option.value ? 'default' : 'outline'}
              onClick={() => setThemeMode(option.value)}
              className="flex items-center gap-2"
            >
              <option.icon className="size-4" />
              {option.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">本の表示</h2>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={hideReadBooks}
            onCheckedChange={(v) => setHideReadBooks(v === true)}
          />
          読了済みの本を一覧に表示しない
        </label>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">アカウント</h2>
        <Button variant="outline" onClick={logout}>
          ログアウト
        </Button>
      </section>
    </main>
  )
}
