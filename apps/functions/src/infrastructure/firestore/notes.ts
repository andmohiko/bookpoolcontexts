import type {
  CreateNoteDto,
  Note,
  NoteId,
  Uid,
  UpdateNoteDtoFromAdmin,
} from '@bookpoolcontexts/common'
import { noteCollection, userCollection } from '@bookpoolcontexts/common'

import { db } from '~/lib/firebase'
import { convertDate } from '~/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

const notesRef = (uid: Uid) =>
  db.collection(userCollection).doc(uid).collection(noteCollection)

const noteDocRef = (uid: Uid, noteId: NoteId) => notesRef(uid).doc(noteId)

/** メモを取得する */
export const fetchNoteOperation = async (
  uid: Uid,
  noteId: NoteId,
): Promise<Note | null> => {
  const snapshot = await noteDocRef(uid, noteId).get()
  if (!snapshot.exists) return null
  const data = snapshot.data()
  if (!data) return null
  return { noteId: snapshot.id, ...convertDate(data, dateColumns) } as Note
}

/** メモ一覧を取得する（ページネーション対応） */
export const fetchNotesOperation = async (
  uid: Uid,
  pageSize: number,
  lastDocument: FirebaseFirestore.DocumentSnapshot | null,
): Promise<{
  items: Array<Note>
  lastDoc: FirebaseFirestore.DocumentSnapshot | null
  hasMore: boolean
}> => {
  let q = notesRef(uid).orderBy('updatedAt', 'desc').limit(pageSize)

  if (lastDocument) {
    q = q.startAfter(lastDocument)
  }

  const snapshot = await q.get()
  const items = snapshot.docs.map(
    (d) => ({ noteId: d.id, ...convertDate(d.data(), dateColumns) }) as Note,
  )
  const lastDoc =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
  const hasMore = snapshot.docs.length === pageSize

  return { items, lastDoc, hasMore }
}

/** メモを作成する */
export const createNoteOperation = async (
  uid: Uid,
  dto: CreateNoteDto,
): Promise<void> => {
  await notesRef(uid).add(dto)
}

/** メモを更新する */
export const updateNoteOperation = async (
  uid: Uid,
  noteId: NoteId,
  dto: UpdateNoteDtoFromAdmin,
): Promise<void> => {
  await noteDocRef(uid, noteId).update(dto)
}

/** メモを削除する */
export const deleteNoteOperation = async (
  uid: Uid,
  noteId: NoteId,
): Promise<void> => {
  await noteDocRef(uid, noteId).delete()
}
