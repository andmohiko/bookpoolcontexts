/**
 * 既存の Book ドキュメントに scrapingStatus フィールドを backfill するスクリプト
 *
 * 処理内容:
 *  - collectionGroup('books') で全ユーザーの books を取得
 *  - ドキュメント1件ずつ処理
 *  - scrapingStatus フィールドが無ければ 'completed' をセット
 *  - すでに存在する場合はスキップ
 *  - updatedAt / updatedBy は更新しない
 *
 * 実行方法:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     pnpm functions exec tsx scripts/backfillScrapingStatus.ts
 *
 *   ドライラン（書き込みを行わずログのみ）:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     pnpm functions exec tsx scripts/backfillScrapingStatus.ts --dry-run
 */
import * as admin from 'firebase-admin'

const isDryRun = process.argv.includes('--dry-run')

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
})

const db = admin.firestore()

type Counters = {
  total: number
  updated: number
  skipped: number
  failed: number
}

const main = async (): Promise<void> => {
  console.log(
    `[backfillScrapingStatus] start ${isDryRun ? '(DRY RUN)' : ''}`,
  )

  const snapshot = await db.collectionGroup('books').get()
  console.log(`[backfillScrapingStatus] fetched ${snapshot.size} documents`)

  const counters: Counters = {
    total: snapshot.size,
    updated: 0,
    skipped: 0,
    failed: 0,
  }

  // ドキュメント1件ずつ逐次処理
  for (const doc of snapshot.docs) {
    const path = doc.ref.path
    try {
      // 最新状態を再取得（snapshot 取得後に更新された可能性に備える）
      const fresh = await doc.ref.get()
      const data = fresh.data()

      if (!data) {
        console.warn(`[skip] ${path} : document not found`)
        counters.skipped += 1
        continue
      }

      if (Object.hasOwn(data, 'scrapingStatus')) {
        console.log(
          `[skip] ${path} : scrapingStatus already exists (${String(data.scrapingStatus)})`,
        )
        counters.skipped += 1
        continue
      }

      if (isDryRun) {
        console.log(`[dry-run] ${path} : would set scrapingStatus='completed'`)
        counters.updated += 1
        continue
      }

      await doc.ref.update({ scrapingStatus: 'completed' })
      console.log(`[updated] ${path} : scrapingStatus='completed'`)
      counters.updated += 1
    } catch (error) {
      counters.failed += 1
      console.error(`[failed] ${path}`, error)
    }
  }

  console.log('[backfillScrapingStatus] done', counters)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backfillScrapingStatus] fatal error', error)
    process.exit(1)
  })
