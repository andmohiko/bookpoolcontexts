import { useNavigate } from '@tanstack/react-router'
import type { Uid } from '@vectornote/common'
import type { FirebaseError } from 'firebase/app'
import type { User } from 'firebase/auth'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { Loader2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { toast } from 'sonner'
import {
  createUserOperation,
  fetchUserOperation,
} from '@/infrastructure/firestore/users'
import { getContext } from '@/integrations/tanstack-query/root-provider'
import { auth, serverTimestamp } from '@/lib/firebase'

const SESSION_LOGIN_AT_KEY = 'auth_login_at'
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30日

const FirebaseAuthContext = createContext<{
  currentUser: User | null | undefined
  uid: string | null | undefined
  login: () => void
  logout: () => Promise<void>
}>({
  currentUser: undefined,
  uid: undefined,
  login: async () => {},
  logout: async () => {},
})

const FirebaseAuthProvider = ({
  children,
}: {
  children: ReactNode
}): ReactNode => {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(
    undefined,
  )
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const navigate = useNavigate()

  const LoadingCover = () => {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2Icon className="size-10 animate-spin" />
      </div>
    )
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // 30日セッション有効期限チェック
        const loginAt = localStorage.getItem(SESSION_LOGIN_AT_KEY)
        if (loginAt) {
          const elapsed = Date.now() - Number(loginAt)
          if (elapsed > SESSION_MAX_AGE_MS) {
            await signOut(auth)
            localStorage.removeItem(SESSION_LOGIN_AT_KEY)
            setCurrentUser(null)
            setUid(null)
            navigate({ to: '/login' })
            return
          }
        }
        setCurrentUser(user)
        setUid(user.uid)
      } else {
        setCurrentUser(null)
        setUid(null)
        navigate({ to: '/login' })
      }
    })
    return () => unsubscribe()
  }, [navigate])

  const login = useCallback(async () => {
    const googleProvider = new GoogleAuthProvider()
    signInWithPopup(auth, googleProvider)
      .then(async (result) => {
        // ログイン成功時にログイン日時を記録
        localStorage.setItem(SESSION_LOGIN_AT_KEY, String(Date.now()))

        // ユーザードキュメントの存在確認
        const uid = result.user.uid as Uid
        const existingUser = await fetchUserOperation(uid)
        if (!existingUser) {
          // ユーザードキュメントが存在しない場合は作成
          await createUserOperation(uid, {
            email: result.user.email ?? '',
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
          })
        }

        navigate({ to: '/' })
      })
      .catch((error: FirebaseError) => {
        // ポップアップを閉じた場合はエラー表示しない
        if (error.code === 'auth/popup-closed-by-user') {
          return
        }
        toast.error('ログインに失敗しました')
        console.error('error with google login', error)
      })
  }, [navigate])

  const logout = useCallback(async () => {
    await signOut(auth)
    localStorage.removeItem(SESSION_LOGIN_AT_KEY)
    const { queryClient } = getContext()
    queryClient.clear()
  }, [])

  return (
    <FirebaseAuthContext.Provider value={{ currentUser, uid, login, logout }}>
      {currentUser === undefined ? <LoadingCover /> : null}
      {children}
    </FirebaseAuthContext.Provider>
  )
}

export { FirebaseAuthContext, FirebaseAuthProvider }

export const useFirebaseAuthContext = () => useContext(FirebaseAuthContext)
