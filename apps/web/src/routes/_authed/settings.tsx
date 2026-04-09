import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { type ThemeMode, useThemeMode } from '@/hooks/useThemeMode'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'

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
  const { logout } = useFirebaseAuthContext()
  const { mode, setThemeMode } = useThemeMode()

  return (
    <main className="pb-8 pt-14">
      <h1 className="mb-8 text-xl font-semibold">設定</h1>

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

      <section>
        <h2 className="mb-4 text-lg font-semibold">アカウント</h2>
        <Button variant="outline" onClick={logout}>
          ログアウト
        </Button>
      </section>
    </main>
  )
}
