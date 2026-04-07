import type { NextFunction, Request, Response } from 'express'
import { auth } from '~/lib/firebase'

/** 認証済みリクエスト型 */
export type AuthenticatedRequest = Request & {
  uid: string
}

/**
 * Firebase Authentication IDトークンを検証する認証ミドルウェア
 * Authorization: Bearer <token> ヘッダーを検証し、uid をリクエストに付与する
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // CORSプリフライトリクエストはそのまま通す
  if (req.method === 'OPTIONS') {
    next()
    return
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      res.status(401).json({ error: '認証トークンがありません' })
      return
    }

    const token = (
      typeof authHeader === 'string' ? authHeader : authHeader[0]
    ).split(' ')[1]

    if (!token) {
      res.status(401).json({ error: '認証トークンの形式が正しくありません' })
      return
    }

    const decodedToken = await auth.verifyIdToken(token)
    if (!decodedToken?.uid) {
      res.status(401).json({ error: '無効な認証トークンです' })
      return
    }

    ;(req as AuthenticatedRequest).uid = decodedToken.uid
    next()
  } catch (_) {
    res.status(401).json({ error: '認証に失敗しました' })
  }
}
