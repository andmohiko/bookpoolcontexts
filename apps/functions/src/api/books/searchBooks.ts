import type { Response } from 'express'
import { validationResult } from 'express-validator'
import type { AuthenticatedRequest } from '~/middleware/auth'
import { searchAmazonBooks } from '~/lib/amazon'

exports.handle = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() })
    }

    const { keyword } = req.body
    const items = await searchAmazonBooks(keyword)

    return res.status(200).json({ items })
  } catch (error) {
    console.error('Book search failed:', error)
    return res.status(500).json({ error: '本の検索に失敗しました' })
  }
}
