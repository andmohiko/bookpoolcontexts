import type {
  CreateTagDtoFromAdmin,
  Tag,
  TagId,
  Uid,
  UpdateTagDtoFromAdmin,
} from '@bookpoolcontexts/common'
import { tagCollection, userCollection } from '@bookpoolcontexts/common'

import { db } from '~/lib/firebase'
import { convertDate } from '~/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

const tagsRef = (uid: Uid) =>
  db.collection(userCollection).doc(uid).collection(tagCollection)

const tagDocRef = (uid: Uid, tagId: TagId) => tagsRef(uid).doc(tagId)

/** ラベル名でタグを取得する */
export const fetchTagByLabelOperation = async (
  uid: Uid,
  label: string,
): Promise<Tag | null> => {
  const snapshot = await tagsRef(uid)
    .where('label', '==', label)
    .limit(1)
    .get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  const data = doc.data()
  return { tagId: doc.id, ...convertDate(data, dateColumns) } as Tag
}

/** タグを作成する（自動生成ID） */
export const createTagOperation = async (
  uid: Uid,
  dto: CreateTagDtoFromAdmin,
): Promise<void> => {
  await tagsRef(uid).add(dto)
}

/** タグを更新する */
export const updateTagOperation = async (
  uid: Uid,
  tagId: TagId,
  dto: UpdateTagDtoFromAdmin,
): Promise<void> => {
  await tagDocRef(uid, tagId).update(dto)
}

/** タグを削除する */
export const deleteTagOperation = async (
  uid: Uid,
  tagId: TagId,
): Promise<void> => {
  await tagDocRef(uid, tagId).delete()
}
