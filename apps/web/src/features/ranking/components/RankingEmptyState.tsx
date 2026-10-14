import { Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'

type RankingEmptyStateProps = {
  targetCount: number
  maxComparisons: number
  isStarting: boolean
  onStart: () => void
}

export const RankingEmptyState = ({
  targetCount,
  maxComparisons,
  isStarting,
  onStart,
}: RankingEmptyStateProps) => {
  const canStart = targetCount >= 2

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border p-8 text-center">
      <Trophy className="size-10 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm">
          未読の本を 2 択で比べて、読みたい順に並べましょう。
        </p>
        {canStart ? (
          <p className="text-sm text-muted-foreground">
            対象: 未読 {targetCount} 冊 / 最大 {maxComparisons} 回の比較
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            ランキングを作るには未読の本が 2 冊以上必要です（現在 {targetCount}{' '}
            冊）
          </p>
        )}
      </div>
      <Button type="button" onClick={onStart} disabled={!canStart || isStarting}>
        {isStarting ? '開始中...' : 'ランキングを作成'}
      </Button>
    </div>
  )
}
