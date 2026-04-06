import type { Analytics } from 'firebase/analytics'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  serverTimestamp as getServerTimeStamp,
} from 'firebase/firestore'
import type { RemoteConfig } from 'firebase/remote-config'
import { getRemoteConfig } from 'firebase/remote-config'
import { getStorage } from 'firebase/storage'

// TanStack Start (Vite) では import.meta.env を使用
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseApp = initializeApp({ ...config })

const auth = getAuth(firebaseApp)
auth.languageCode = 'ja'
setPersistence(auth, browserLocalPersistence)

const db = getFirestore(firebaseApp)
const serverTimestamp = getServerTimeStamp()

const storage = getStorage(firebaseApp)

// Remote Config はクライアント側でのみ初期化
let remoteConfig: RemoteConfig | null = null
if (typeof window !== 'undefined') {
  remoteConfig = getRemoteConfig(firebaseApp)
  remoteConfig.settings.minimumFetchIntervalMillis = 60 * 1000 // 1min
}

// Analytics はクライアント側でのみ初期化
let analytics: Analytics | null = null
if (typeof window !== 'undefined') {
  // ブラウザが Analytics をサポートしているかチェック
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(firebaseApp)
    }
  })
}

// エミュレーター接続（開発環境）
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080)
}

export { auth, db, serverTimestamp, storage, remoteConfig, analytics }
