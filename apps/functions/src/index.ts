import 'source-map-support/register'
import { onRequest } from 'firebase-functions/v2/https'
import app from './router'

const timezone = 'Asia/Tokyo'
process.env.TZ = timezone

// triggers
export { onCreateBook } from './triggers/onCreateBook'
export { onUpdateBook } from './triggers/onUpdateBook'
export { onDeleteBook } from './triggers/onDeleteBook'
export { onDeleteGroup } from './triggers/onDeleteGroup'

// API
export const api = onRequest(
  {
    region: 'asia-northeast1',
    memory: '2GiB',
    // Cloud Run IAM: allUsers に invoker 権限を付与（アプリ側で認証を行う）
    invoker: 'public',
    // Cloud Run レベルでの CORS 許可（OPTIONS プリフライトを通す）
    cors: true,
  },
  app,
)
