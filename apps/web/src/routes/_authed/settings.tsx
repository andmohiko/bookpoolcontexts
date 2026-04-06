import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { logout } = useFirebaseAuthContext()

  return (
    <main className="pb-8 pt-14">
      <h1 className="mb-8 text-xl font-semibold">設定</h1>

      <section>
        <h2 className="mb-4 text-lg font-semibold">アカウント</h2>
        <Button variant="outline" onClick={logout}>
          ログアウト
        </Button>
      </section>
    </main>
  )
}
