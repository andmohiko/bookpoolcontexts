import type { FieldValue } from 'firebase/firestore'

import type { BookId } from './Book'

/** コレクション名 */
export const rankingCollection = 'rankings' as const

/** ランキングドキュメントの固定ID（ユーザーごとに1つ） */
export const currentRankingId = 'current' as const

/** ID型エイリアス */
export type RankingId = string

/** ランキングの状態。sorting はソート進行中（中断中を含む） */
export type RankingStatus = 'idle' | 'sorting'

/**
 * ソートのモード
 * - create: 候補全体をマージソートする
 * - update: 候補を既存ランキングへ二分挿入する
 */
export type RankingMode = 'create' | 'update'

/** 2択比較の回答1件 */
export type RankingDecision = {
  winner: BookId
  loser: BookId
}

/** Entity型（Firestoreから取得したデータ、Date変換済み） */
export type Ranking = {
  rankingId: RankingId
  status: RankingStatus
  mode: RankingMode | null
  candidateBookIds: Array<BookId>
  decisions: Array<RankingDecision>
  rankedBookIds: Array<BookId>
  excludedBookIds: Array<BookId>
  createdAt: Date
  updatedAt: Date
}

/** 作成用DTO */
export type CreateRankingDto = Omit<
  Ranking,
  'rankingId' | 'createdAt' | 'updatedAt'
> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

/** 更新用DTO。decisions / excludedBookIds は arrayUnion / arrayRemove を許可する */
export type UpdateRankingDto = {
  status?: Ranking['status']
  mode?: Ranking['mode']
  candidateBookIds?: Ranking['candidateBookIds']
  decisions?: Ranking['decisions'] | FieldValue
  rankedBookIds?: Ranking['rankedBookIds']
  excludedBookIds?: Ranking['excludedBookIds'] | FieldValue
  updatedAt: FieldValue
}
