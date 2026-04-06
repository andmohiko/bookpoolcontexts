import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { auth } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    await auth.authStateReady()
    if (auth.currentUser) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { login } = useFirebaseAuthContext()

  return (
    <main className="flex h-screen w-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold">BookPoolContexts</h1>
        <Button onClick={login}>Googleでログイン</Button>
      </div>
    </main>
  )
}
