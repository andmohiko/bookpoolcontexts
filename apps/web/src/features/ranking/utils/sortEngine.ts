import type {
  BookId,
  RankingDecision,
  RankingMode,
} from '@bookpoolcontexts/common'

/**
 * ソートエンジンの入力。
 * React / Firestore に依存しない純粋なデータのみを受け取る。
 */
export type SortInput = {
  mode: RankingMode
  /** 現在も有効（未読・未削除・未除外）な候補だけに絞ったもの */
  candidateBookIds: Array<BookId>
  /** update のとき既存ランキング（有効な本だけに絞ったもの）。create では [] */
  baseRankedBookIds: Array<BookId>
  decisions: Array<RankingDecision>
}

export type SortProgress =
  | {
      status: 'needComparison'
      left: BookId
      right: BookId
      /** 有効な候補に関する回答数 */
      answered: number
      /** 最悪比較回数 */
      maxTotal: number
    }
  | { status: 'completed'; order: Array<BookId> }

/** 2冊の組をログ検索用の一意なキーに変換する（順序非依存） */
const decisionKey = (a: BookId, b: BookId): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`

/** 未知の比較に到達したことを示す内部例外 */
class UnknownComparisonError extends Error {
  constructor(
    readonly left: BookId,
    readonly right: BookId,
  ) {
    super('unknown comparison')
    this.name = 'UnknownComparisonError'
  }
}

/** 回答ログから「組 → 勝者」の対応表を作る */
const buildDecisionMap = (
  decisions: Array<RankingDecision>,
): Map<string, BookId> => {
  const map = new Map<string, BookId>()
  for (const decision of decisions) {
    // 同じ組が複数回記録された場合は後の回答を採用する
    map.set(decisionKey(decision.winner, decision.loser), decision.winner)
  }
  return map
}

type Comparator = {
  /** a が b より上位なら true。未知の比較なら UnknownComparisonError を投げる */
  isHigher: (a: BookId, b: BookId) => boolean
  /** 実際に参照された回答の件数 */
  getAnsweredCount: () => number
}

/**
 * 記憶付きコンパレータを作る。
 * - update で両方が既存ランキングに含まれる場合は既存順位で決定する（問い合わせなし）
 * - 回答ログにあれば記録どおりに決定する
 * - どちらでもなければ未知として計算を中断する
 */
const createComparator = (
  decisions: Array<RankingDecision>,
  baseRankedBookIds: Array<BookId>,
): Comparator => {
  const decisionMap = buildDecisionMap(decisions)
  const basePositions = new Map<BookId, number>(
    baseRankedBookIds.map((bookId, index) => [bookId, index]),
  )
  let answered = 0

  const isHigher = (a: BookId, b: BookId): boolean => {
    const aBasePosition = basePositions.get(a)
    const bBasePosition = basePositions.get(b)
    if (aBasePosition !== undefined && bBasePosition !== undefined) {
      return aBasePosition < bBasePosition
    }

    const winner = decisionMap.get(decisionKey(a, b))
    if (winner !== undefined) {
      answered += 1
      return winner === a
    }

    throw new UnknownComparisonError(a, b)
  }

  return { isHigher, getAnsweredCount: () => answered }
}

/** 2 つのソート済み列をマージする。未知の比較に当たると例外で中断する */
const merge = (
  left: Array<BookId>,
  right: Array<BookId>,
  comparator: Comparator,
): Array<BookId> => {
  const merged: Array<BookId> = []
  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    if (comparator.isHigher(left[leftIndex], right[rightIndex])) {
      merged.push(left[leftIndex])
      leftIndex += 1
    } else {
      merged.push(right[rightIndex])
      rightIndex += 1
    }
  }
  while (leftIndex < left.length) {
    merged.push(left[leftIndex])
    leftIndex += 1
  }
  while (rightIndex < right.length) {
    merged.push(right[rightIndex])
    rightIndex += 1
  }
  return merged
}

/**
 * ボトムアップのマージソート。未知の比較に当たると例外で中断する。
 *
 * トップダウン（再帰）ではなくボトムアップにしているのは出題順のため。
 * 再帰だと前半の数冊を完全に並べ終えてから後半に移るので、全体の 1/4 を
 * 答え終わってもまだ見ていない本が残り、「全体像が見えないまま細部の
 * 順位付けに入る」体験になる。
 *
 * ボトムアップは幅優先に進むため、最初の ⌈n/2⌉ 問で全冊が 1 回ずつ登場し、
 * そこから段階的に精度が上がる。総比較回数はトップダウンとほぼ同じ。
 */
const mergeSort = (
  bookIds: Array<BookId>,
  comparator: Comparator,
): Array<BookId> => {
  if (bookIds.length <= 1) return bookIds

  // 1 冊ずつのランから始め、隣接するランを 1 段ずつマージしていく
  let runs: Array<Array<BookId>> = bookIds.map((bookId) => [bookId])

  while (runs.length > 1) {
    const nextRuns: Array<Array<BookId>> = []
    for (let i = 0; i + 1 < runs.length; i += 2) {
      nextRuns.push(merge(runs[i], runs[i + 1], comparator))
    }

    // ランの数が奇数なら最後の 1 本が余る。これを次の段へ素通しすると、
    // その中の本が終盤まで一度も出題されない（n=9 なら 9 冊目が 16 問目まで
    // 登場しない）。最短のランへ畳んで、全冊が早い段階で登場するようにする。
    if (runs.length % 2 === 1) {
      const leftover = runs[runs.length - 1]
      if (nextRuns.length === 0) {
        nextRuns.push(leftover)
      } else {
        let shortestIndex = 0
        for (let i = 1; i < nextRuns.length; i += 1) {
          if (nextRuns[i].length < nextRuns[shortestIndex].length) {
            shortestIndex = i
          }
        }
        nextRuns[shortestIndex] = merge(
          nextRuns[shortestIndex],
          leftover,
          comparator,
        )
      }
    }

    runs = nextRuns
  }

  return runs[0]
}

/** 既存ランキングへ候補を1冊ずつ二分挿入する。未知の比較に当たると例外で中断する */
const binaryInsertAll = (
  baseRankedBookIds: Array<BookId>,
  candidateBookIds: Array<BookId>,
  comparator: Comparator,
): Array<BookId> => {
  let list = [...baseRankedBookIds]

  for (const candidate of candidateBookIds) {
    let low = 0
    let high = list.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (comparator.isHigher(candidate, list[middle])) {
        high = middle
      } else {
        low = middle + 1
      }
    }
    list = [...list.slice(0, low), candidate, ...list.slice(low)]
  }

  return list
}

/**
 * ボトムアップのマージソートの最悪比較回数。
 *
 * ラン構造をそのままたどって、各マージの最悪コスト
 * （= 左の長さ + 右の長さ − 1）を積み上げる。
 *
 * トップダウンの公式 `n⌈log₂n⌉ − 2^⌈log₂n⌉ + 1` は使えない。
 * n が 2 の冪でないとき、相手がいないランが次の段に持ち上げられて
 * 長い列同士のマージになるため、実際の最悪値が公式を上回る
 * （n=5 なら 9 回で公式の 8 を超える。n=9 なら 25 対 21）。
 *
 * n=1〜9 の全順列で実測の最悪値と一致することを確認済み。
 */
const estimateCreateMaxComparisons = (candidateCount: number): number => {
  if (candidateCount <= 1) return 0

  let runLengths = Array.from({ length: candidateCount }, () => 1)
  let total = 0

  while (runLengths.length > 1) {
    const nextRunLengths: Array<number> = []
    for (let i = 0; i + 1 < runLengths.length; i += 2) {
      // 1 回のマージは最悪で「両列の長さの合計 − 1」回の比較を要する
      total += runLengths[i] + runLengths[i + 1] - 1
      nextRunLengths.push(runLengths[i] + runLengths[i + 1])
    }

    // mergeSort と同じく、余ったランは最短のランへ畳む
    if (runLengths.length % 2 === 1) {
      const leftover = runLengths[runLengths.length - 1]
      if (nextRunLengths.length === 0) {
        nextRunLengths.push(leftover)
      } else {
        let shortestIndex = 0
        for (let i = 1; i < nextRunLengths.length; i += 1) {
          if (nextRunLengths[i] < nextRunLengths[shortestIndex]) {
            shortestIndex = i
          }
        }
        total += nextRunLengths[shortestIndex] + leftover - 1
        nextRunLengths[shortestIndex] += leftover
      }
    }

    runLengths = nextRunLengths
  }

  return total
}

/**
 * 二分挿入の最悪比較回数。
 * Σ_{i=1..k} ⌈log₂(n+i)⌉
 *
 * 挿入ごとにリストが1冊伸びるため、k × ⌈log₂(n+1)⌉ では実測を下回ることがある。
 */
const estimateUpdateMaxComparisons = (
  candidateCount: number,
  baseCount: number,
): number => {
  let total = 0
  for (let i = 1; i <= candidateCount; i += 1) {
    const listLength = baseCount + i
    if (listLength <= 1) continue
    total += Math.ceil(Math.log2(listLength))
  }
  return total
}

/** モードに応じた最悪比較回数を返す */
export const estimateMaxComparisons = (
  mode: RankingMode,
  candidateCount: number,
  baseCount: number,
): number =>
  mode === 'create'
    ? estimateCreateMaxComparisons(candidateCount)
    : estimateUpdateMaxComparisons(candidateCount, baseCount)

/**
 * 回答ログからソートの進捗を再計算する純粋関数。
 *
 * 決定的なので、同じ入力なら常に同じ2択を返す（中断・再開の再現性）。
 */
export const computeSortProgress = (input: SortInput): SortProgress => {
  const { mode, decisions } = input

  /**
   * ID の重複を取り除く。
   *
   * 同じ ID が 2 つ以上あると自分自身との比較が発生し、2 択の左右に同じ本が
   * 並んでしまう。候補と既存ランキングに同じ ID が含まれる場合も同様なので、
   * 既存ランキングを優先して候補側から除く。
   */
  const baseRankedBookIds = [...new Set(input.baseRankedBookIds)]
  const baseRankedBookIdSet = new Set(baseRankedBookIds)
  const candidateBookIds = [...new Set(input.candidateBookIds)].filter(
    (bookId) => mode === 'create' || !baseRankedBookIdSet.has(bookId),
  )

  // update では候補同士も比較しうるため、既存ランキングのみを順位の根拠にする
  const comparator = createComparator(
    decisions,
    mode === 'update' ? baseRankedBookIds : [],
  )

  try {
    const order =
      mode === 'create'
        ? mergeSort(candidateBookIds, comparator)
        : binaryInsertAll(baseRankedBookIds, candidateBookIds, comparator)
    return { status: 'completed', order }
  } catch (error) {
    if (!(error instanceof UnknownComparisonError)) throw error
    return {
      status: 'needComparison',
      left: error.left,
      right: error.right,
      answered: comparator.getAnsweredCount(),
      maxTotal: estimateMaxComparisons(
        mode,
        candidateBookIds.length,
        baseRankedBookIds.length,
      ),
    }
  }
}
