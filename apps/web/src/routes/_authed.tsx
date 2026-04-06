import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { auth } from '@/lib/firebase'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    await auth.authStateReady()
    if (!auth.currentUser) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  return <Outlet />
}
