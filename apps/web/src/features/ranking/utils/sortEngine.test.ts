import type { BookId, RankingDecision } from '@bookpoolcontexts/common'
import { describe, expect, it } from 'vitest'

import type { SortInput } from './sortEngine'
import { computeSortProgress, estimateMaxComparisons } from './sortEngine'

const makeIds = (count: number): Array<BookId> =>
  Array.from({ length: count }, (_, i) => `b${i}`)

const decisionKey = (a: BookId, b: BookId): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`

type RunResult = {
  order: Array<BookId>
  decisions: Array<RankingDecision>
  askedPairs: Array<string>
  /** 既存ランキング同士の比較が要求された回数 */
  baseVsBaseCount: number
}

/**
 * 順位表に従って2択に自動回答し、ソートを完了まで進める。
 * rank の値が小さいほど上位（より読みたい）とみなす。
 */
const runSort = (
  input: Omit<SortInput, 'decisions'>,
  rank: Map<BookId, number>,
): RunResult => {
  const decisions: Array<RankingDecision> = []
  const askedPairs: Array<string> = []
  const baseSet = new Set(input.baseRankedBookIds)
  let baseVsBaseCount = 0

  // 比較回数の上限を十分に超えたら無限ループとみなす
  const safetyLimit = 10_000
  for (let step = 0; step < safetyLimit; step += 1) {
    const progress = computeSortProgress({ ...input, decisions })
    if (progress.status === 'completed') {
      return { order: progress.order, decisions, askedPairs, baseVsBaseCount }
    }

    const { left, right } = progress
    // 同じ本が左右に並ぶのは常にバグ
    if (left === right) {
      throw new Error(`同じ本が左右に出題されました: ${left}`)
    }
    askedPairs.push(decisionKey(left, right))
    if (baseSet.has(left) && baseSet.has(right)) baseVsBaseCount += 1

    const leftRank = rank.get(left)
    const rightRank = rank.get(right)
    if (leftRank === undefined || rightRank === undefined) {
      throw new Error(`rank が未定義: ${left} / ${right}`)
    }
    const winner = leftRank < rightRank ? left : right
    decisions.push({ winner, loser: winner === left ? right : left })
  }

  throw new Error('ソートが完了しませんでした（無限ループの可能性）')
}

/** 均等な乱数ではなく決定的な擬似乱数を使い、テストを再現可能にする */
const createRandom = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

describe('computeSortProgress - create モード', () => {
  it('候補が0冊なら即completed', () => {
    const progress = computeSortProgress({
      mode: 'create',
      candidateBookIds: [],
      baseRankedBookIds: [],
      decisions: [],
    })
    expect(progress).toEqual({ status: 'completed', order: [] })
  })

  it('候補が1冊なら比較せずcompleted', () => {
    const progress = computeSortProgress({
      mode: 'create',
      candidateBookIds: ['b0'],
      baseRankedBookIds: [],
      decisions: [],
    })
    expect(progress).toEqual({ status: 'completed', order: ['b0'] })
  })

  it('回答をすべて「左が勝ち」で埋めると候補順がそのまま確定する', () => {
    const candidateBookIds = makeIds(8)
    const decisions: Array<RankingDecision> = []

    for (let step = 0; step < 100; step += 1) {
      const progress = computeSortProgress({
        mode: 'create',
        candidateBookIds,
        baseRankedBookIds: [],
        decisions,
      })
      if (progress.status === 'completed') {
        // マージソートは安定なので、常に左を選ぶと元の順序が保たれる
        expect(progress.order).toEqual(candidateBookIds)
        return
      }
      decisions.push({ winner: progress.left, loser: progress.right })
    }
    throw new Error('ソートが完了しませんでした')
  })

  it('順位表どおりの順序に並ぶ', () => {
    const candidateBookIds = makeIds(10)
    // b9 が最上位、b0 が最下位になるよう逆順の順位を与える
    const rank = new Map(candidateBookIds.map((id, i) => [id, 10 - i]))

    const { order } = runSort(
      { mode: 'create', candidateBookIds, baseRankedBookIds: [] },
      rank,
    )

    expect(order).toEqual([...candidateBookIds].reverse())
  })

  it('同じ入力を2回渡すと同じ2択が返る（再開の再現性）', () => {
    const candidateBookIds = makeIds(7)
    const decisions: Array<RankingDecision> = [
      { winner: 'b0', loser: 'b1' },
      { winner: 'b3', loser: 'b4' },
    ]
    const input: SortInput = {
      mode: 'create',
      candidateBookIds,
      baseRankedBookIds: [],
      decisions,
    }

    const first = computeSortProgress(input)
    const second = computeSortProgress(input)

    expect(first).toEqual(second)
    expect(first.status).toBe('needComparison')
  })

  it('同じ組の比較が2回要求されない', () => {
    const candidateBookIds = makeIds(12)
    const random = createRandom(42)
    const rank = new Map(candidateBookIds.map((id) => [id, random()]))

    const { askedPairs } = runSort(
      { mode: 'create', candidateBookIds, baseRankedBookIds: [] },
      rank,
    )

    expect(new Set(askedPairs).size).toBe(askedPairs.length)
  })

  it('途中で候補を1冊除外しても矛盾なく続行できる', () => {
    const allIds = makeIds(6)
    const rank = new Map(allIds.map((id, i) => [id, i]))
    const decisions: Array<RankingDecision> = []
    let candidateBookIds = [...allIds]
    let hasExcluded = false

    for (let step = 0; step < 100; step += 1) {
      const progress = computeSortProgress({
        mode: 'create',
        candidateBookIds,
        baseRankedBookIds: [],
        decisions,
      })
      if (progress.status === 'completed') {
        // 除外した b2 を含まず、残り5冊が順位どおりに並ぶ
        expect(progress.order).toEqual(['b0', 'b1', 'b3', 'b4', 'b5'])
        return
      }

      // 3回答えた時点で b2 を除外する（回答ログは保持したまま）
      if (!hasExcluded && decisions.length === 3) {
        candidateBookIds = candidateBookIds.filter((id) => id !== 'b2')
        hasExcluded = true
        continue
      }

      const { left, right } = progress
      const winner =
        (rank.get(left) as number) < (rank.get(right) as number) ? left : right
      decisions.push({ winner, loser: winner === left ? right : left })
    }
    throw new Error('ソートが完了しませんでした')
  })

  it('undo（末尾1件削除）で直前の2択が再提示される', () => {
    const candidateBookIds = makeIds(5)
    const rank = new Map(candidateBookIds.map((id, i) => [id, i]))
    const decisions: Array<RankingDecision> = []

    // 3問だけ回答する
    for (let step = 0; step < 3; step += 1) {
      const progress = computeSortProgress({
        mode: 'create',
        candidateBookIds,
        baseRankedBookIds: [],
        decisions,
      })
      if (progress.status !== 'needComparison') {
        throw new Error('3問回答する前に完了しました')
      }
      const { left, right } = progress
      const winner =
        (rank.get(left) as number) < (rank.get(right) as number) ? left : right
      decisions.push({ winner, loser: winner === left ? right : left })
    }

    const last = decisions[decisions.length - 1]
    const afterUndo = computeSortProgress({
      mode: 'create',
      candidateBookIds,
      baseRankedBookIds: [],
      decisions: decisions.slice(0, -1),
    })

    if (afterUndo.status !== 'needComparison') {
      throw new Error('undo 後に完了してしまいました')
    }
    expect(decisionKey(afterUndo.left, afterUndo.right)).toBe(
      decisionKey(last.winner, last.loser),
    )
  })

  it('answered が有効な回答数を反映する', () => {
    const candidateBookIds = makeIds(8)
    const decisions: Array<RankingDecision> = [{ winner: 'b0', loser: 'b1' }]

    const progress = computeSortProgress({
      mode: 'create',
      candidateBookIds,
      baseRankedBookIds: [],
      decisions,
    })

    if (progress.status !== 'needComparison') {
      throw new Error('needComparison を期待しました')
    }
    expect(progress.answered).toBe(1)
    expect(progress.maxTotal).toBe(17)
  })
})

describe('computeSortProgress - update モード', () => {
  it('既存ランキング同士の比較が一度も要求されない', () => {
    const baseRankedBookIds = ['r0', 'r1', 'r2', 'r3', 'r4']
    const candidateBookIds = ['n0', 'n1']
    const rank = new Map<BookId, number>([
      ['r0', 0],
      ['r1', 1],
      ['r2', 2],
      ['r3', 3],
      ['r4', 4],
      ['n0', 1.5],
      ['n1', 4.5],
    ])

    const { order, baseVsBaseCount } = runSort(
      { mode: 'update', candidateBookIds, baseRankedBookIds },
      rank,
    )

    expect(baseVsBaseCount).toBe(0)
    expect(order).toEqual(['r0', 'r1', 'n0', 'r2', 'r3', 'r4', 'n1'])
  })

  it('既存ランキングの相対順序が保たれる', () => {
    const baseRankedBookIds = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5']
    const candidateBookIds = ['n0', 'n1', 'n2']
    const random = createRandom(7)
    const rank = new Map<BookId, number>(
      baseRankedBookIds.map((id, i) => [id, i]),
    )
    for (const id of candidateBookIds) {
      rank.set(id, random() * baseRankedBookIds.length)
    }

    const { order } = runSort(
      { mode: 'update', candidateBookIds, baseRankedBookIds },
      rank,
    )

    const baseOrderInResult = order.filter((id) =>
      baseRankedBookIds.includes(id),
    )
    expect(baseOrderInResult).toEqual(baseRankedBookIds)
    expect(order).toHaveLength(
      baseRankedBookIds.length + candidateBookIds.length,
    )
  })

  it('既存ランキングが空なら候補同士を比較して並べる', () => {
    const candidateBookIds = ['n0', 'n1', 'n2']
    const rank = new Map<BookId, number>([
      ['n0', 2],
      ['n1', 0],
      ['n2', 1],
    ])

    const { order, baseVsBaseCount } = runSort(
      { mode: 'update', candidateBookIds, baseRankedBookIds: [] },
      rank,
    )

    expect(baseVsBaseCount).toBe(0)
    expect(order).toEqual(['n1', 'n2', 'n0'])
  })

  it('候補が0冊なら既存ランキングをそのまま返す', () => {
    const baseRankedBookIds = ['r0', 'r1', 'r2']
    const progress = computeSortProgress({
      mode: 'update',
      candidateBookIds: [],
      baseRankedBookIds,
      decisions: [],
    })
    expect(progress).toEqual({ status: 'completed', order: baseRankedBookIds })
  })

  it('同じ組の比較が2回要求されない', () => {
    const baseRankedBookIds = Array.from({ length: 10 }, (_, i) => `r${i}`)
    const candidateBookIds = ['n0', 'n1', 'n2', 'n3']
    const random = createRandom(99)
    const rank = new Map<BookId, number>(
      baseRankedBookIds.map((id, i) => [id, i]),
    )
    for (const id of candidateBookIds) {
      rank.set(id, random() * baseRankedBookIds.length)
    }

    const { askedPairs } = runSort(
      { mode: 'update', candidateBookIds, baseRankedBookIds },
      rank,
    )

    expect(new Set(askedPairs).size).toBe(askedPairs.length)
  })
})

describe('computeSortProgress - 同じ本が左右に並ばない（重複防御）', () => {
  it('create: 候補に重複 ID があっても left !== right', () => {
    const candidateBookIds = ['a', 'b', 'a', 'c', 'b']
    const decisions: Array<RankingDecision> = []

    for (let step = 0; step < 50; step += 1) {
      const progress = computeSortProgress({
        mode: 'create',
        candidateBookIds,
        baseRankedBookIds: [],
        decisions,
      })
      if (progress.status === 'completed') {
        // 重複が排除され、各本が 1 回だけ現れる
        expect([...progress.order].sort()).toEqual(['a', 'b', 'c'])
        return
      }
      expect(progress.left).not.toBe(progress.right)
      decisions.push({ winner: progress.left, loser: progress.right })
    }
    throw new Error('ソートが完了しませんでした')
  })

  it('update: 候補が既存ランキングにも含まれていても left !== right', () => {
    const baseRankedBookIds = ['r0', 'n1', 'r2']
    const candidateBookIds = ['n1', 'n2']
    const decisions: Array<RankingDecision> = []

    for (let step = 0; step < 50; step += 1) {
      const progress = computeSortProgress({
        mode: 'update',
        candidateBookIds,
        baseRankedBookIds,
        decisions,
      })
      if (progress.status === 'completed') {
        // n1 は既存ランキング側だけに残り、重複しない
        expect(progress.order.filter((id) => id === 'n1')).toHaveLength(1)
        expect(new Set(progress.order).size).toBe(progress.order.length)
        return
      }
      expect(progress.left).not.toBe(progress.right)
      decisions.push({ winner: progress.left, loser: progress.right })
    }
    throw new Error('ソートが完了しませんでした')
  })

  it('update: 既存ランキング自体に重複があっても結果が重複しない', () => {
    const progress = computeSortProgress({
      mode: 'update',
      candidateBookIds: [],
      baseRankedBookIds: ['r0', 'r1', 'r0', 'r2'],
      decisions: [],
    })

    expect(progress).toEqual({
      status: 'completed',
      order: ['r0', 'r1', 'r2'],
    })
  })

  it('確定した順序に同じ本が 2 回現れない（ランダム検証）', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const random = createRandom(seed * 13)
      const ids = makeIds(10)
      // 意図的に重複を混ぜる
      const candidateBookIds = [...ids, ids[2], ids[7]]
      const rank = new Map(ids.map((id) => [id, random()]))

      const { order } = runSort(
        { mode: 'create', candidateBookIds, baseRankedBookIds: [] },
        rank,
      )

      expect(new Set(order).size).toBe(order.length)
      expect(order).toHaveLength(ids.length)
    }
  })
})

describe('computeSortProgress - 出題順（全体像を先に見せる）', () => {
  it('最初の ⌈n/2⌉ 問で全冊が 1 回ずつ登場する', () => {
    const candidateBookIds = makeIds(12)
    const random = createRandom(5)
    const rank = new Map(candidateBookIds.map((id) => [id, random()]))

    const { askedPairs } = runSort(
      { mode: 'create', candidateBookIds, baseRankedBookIds: [] },
      rank,
    )

    // 先頭 6 問に登場した本を数える
    const firstRound = askedPairs.slice(0, Math.ceil(12 / 2))
    const seen = new Set(firstRound.flatMap((pair) => pair.split('|')))
    expect(seen.size).toBe(12)
  })

  it('偶数・奇数どちらでも ⌈n/2⌉ 問で全冊に触れる', () => {
    for (const count of [8, 9, 10, 15, 16, 20]) {
      const candidateBookIds = makeIds(count)
      const random = createRandom(count * 3)
      const rank = new Map(candidateBookIds.map((id) => [id, random()]))

      const { askedPairs } = runSort(
        { mode: 'create', candidateBookIds, baseRankedBookIds: [] },
        rank,
      )

      // 全冊が出題されるまでに要した問数
      const seen = new Set<string>()
      let coverageAt = askedPairs.length
      for (const [index, pair] of askedPairs.entries()) {
        for (const id of pair.split('|')) seen.add(id)
        if (seen.size === count) {
          coverageAt = index + 1
          break
        }
      }

      // トップダウンだと n を超えることもあるが、ボトムアップは ⌈n/2⌉ で全冊に触れる
      expect(coverageAt).toBe(Math.ceil(count / 2))
    }
  })
})

describe('estimateMaxComparisons - create', () => {
  // n=1〜9 は全順列を網羅して実測した最悪値と一致する
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 3],
    [4, 5],
    [5, 8],
    [6, 11],
    [7, 15],
    [8, 17],
    [9, 21],
    [10, 25],
    [12, 33],
    [16, 49],
    [20, 69],
  ])('n=%i のとき %i', (candidateCount, expected) => {
    expect(estimateMaxComparisons('create', candidateCount, 0)).toBe(expected)
  })

  it('トップダウンの公式と同等以下に収まる', () => {
    const topDownFormula = (n: number): number => {
      const depth = Math.ceil(Math.log2(n))
      return n * depth - 2 ** depth + 1
    }
    // 余りのランを畳む実装により、奇数個でも公式を超えない
    for (const n of [2, 3, 4, 5, 6, 8, 9, 10, 12, 16, 20]) {
      expect(estimateMaxComparisons('create', n, 0)).toBeLessThanOrEqual(
        topDownFormula(n),
      )
    }
  })

  it('実際のソートの比較回数が上限を超えない', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 32, 50]) {
      const candidateBookIds = makeIds(count)
      const limit = estimateMaxComparisons('create', count, 0)

      for (let seed = 1; seed <= 20; seed += 1) {
        const random = createRandom(seed * 31)
        const rank = new Map(candidateBookIds.map((id) => [id, random()]))
        const { decisions } = runSort(
          { mode: 'create', candidateBookIds, baseRankedBookIds: [] },
          rank,
        )
        expect(decisions.length).toBeLessThanOrEqual(limit)
      }
    }
  })
})

describe('estimateMaxComparisons - update', () => {
  it.each([
    [0, 3, 3],
    [7, 3, 11],
    [10, 3, 12],
    [15, 5, 24],
    [100, 4, 28],
    [1, 1, 1],
    [5, 0, 0],
  ])(
    'base=%i, candidates=%i のとき %i',
    (baseCount, candidateCount, expected) => {
      expect(estimateMaxComparisons('update', candidateCount, baseCount)).toBe(
        expected,
      )
    },
  )

  it('k × ⌈log₂(n+1)⌉ より小さくならない（過小評価の回帰防止）', () => {
    // base=7, k=3 では過小な式は 9 だが、実測上限は 11
    expect(estimateMaxComparisons('update', 3, 7)).toBeGreaterThan(
      3 * Math.ceil(Math.log2(8)),
    )
  })

  it('実際の挿入の比較回数が上限を超えない', () => {
    const cases: Array<[number, number]> = [
      [7, 3],
      [10, 3],
      [15, 5],
      [0, 3],
      [3, 2],
    ]

    for (const [baseCount, candidateCount] of cases) {
      const baseRankedBookIds = Array.from(
        { length: baseCount },
        (_, i) => `r${i}`,
      )
      const candidateBookIds = Array.from(
        { length: candidateCount },
        (_, i) => `n${i}`,
      )
      const limit = estimateMaxComparisons('update', candidateCount, baseCount)

      for (let seed = 1; seed <= 20; seed += 1) {
        const random = createRandom(seed * 17)
        const rank = new Map<BookId, number>(
          baseRankedBookIds.map((id, i) => [id, i]),
        )
        for (const id of candidateBookIds) {
          rank.set(id, random() * (baseCount + 1) - 0.5)
        }

        const { decisions } = runSort(
          { mode: 'update', candidateBookIds, baseRankedBookIds },
          rank,
        )
        expect(decisions.length).toBeLessThanOrEqual(limit)
      }
    }
  })
})
