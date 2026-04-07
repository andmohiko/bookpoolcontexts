import { auth } from '@/lib/firebase'

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL

/** 認証付きでFirebase Functions APIを呼び出す */
export const authenticatedFetch = async <T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> => {
  const user = auth.currentUser
  if (!user) throw new Error('認証エ��ー：再ログインしてください')

  const idToken = await user.getIdToken()

  const response = await fetch(`${FUNCTIONS_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      (errorData as { error?: string }).error || `APIエラー: ${response.status}`,
    )
  }

  return response.json() as Promise<T>
}
