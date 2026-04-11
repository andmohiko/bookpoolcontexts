/**
 * タグラベルを正規化する
 * - 前後の空白を除去
 * - Unicode NFC 正規化（濁点・半角全角のゆらぎを統一）
 *
 * 大文字小文字の変換は行わない（React と react を同一視するかは要件次第で、
 * 現状は区別する方針。区別したくなったら toLowerCase を追加する）
 */
export const normalizeTagLabel = (label: string): string => {
  return label.trim().normalize('NFC')
}
