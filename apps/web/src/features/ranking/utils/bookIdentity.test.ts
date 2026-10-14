import type { Book } from '@bookpoolcontexts/common'
import { describe, expect, it } from 'vitest'

import { getBookIdentity } from './bookIdentity'

const makeBook = (overrides: Partial<Book>): Book => ({
  bookId: 'id',
  amazonUrl: '',
  author: null,
  coverImageUrl: null,
  createdAt: new Date(),
  foundBy: '',
  groups: [],
  isRead: false,
  location: '',
  note: '',
  pages: null,
  purchasedBy: [],
  scrapingStatus: 'completed',
  tags: [],
  title: null,
  updatedAt: new Date(),
  updatedBy: 'user',
  ...overrides,
})

describe('getBookIdentity', () => {
  it('同じ ASIN なら URL の形が違っても同じキーになる', () => {
    const a = makeBook({
      bookId: 'a',
      amazonUrl: 'https://www.amazon.co.jp/dp/4622086999',
    })
    const b = makeBook({
      bookId: 'b',
      amazonUrl:
        'https://www.amazon.co.jp/%E3%83%86%E3%82%AF%E3%83%8B%E3%82%A6%E3%83%A0/dp/4622086999?ref=sr_1_1&qid=123',
    })

    expect(getBookIdentity(a)).toBe(getBookIdentity(b))
  })

  it('ASIN が違えば別のキーになる', () => {
    const a = makeBook({ amazonUrl: 'https://www.amazon.co.jp/dp/4622086999' })
    const b = makeBook({ amazonUrl: 'https://www.amazon.co.jp/dp/4150503571' })

    expect(getBookIdentity(a)).not.toBe(getBookIdentity(b))
  })

  it('ASIN が取れない URL はクエリを除いたパスで判定する', () => {
    const a = makeBook({ amazonUrl: 'https://amzn.asia/d/abcdef?utm=1' })
    const b = makeBook({ amazonUrl: 'https://amzn.asia/d/abcdef?utm=2' })

    expect(getBookIdentity(a)).toBe(getBookIdentity(b))
  })

  it('URL が空ならタイトルと著者で判定する', () => {
    const a = makeBook({ title: 'テクニウム', author: 'ケヴィン・ケリー' })
    const b = makeBook({ title: 'テクニウム', author: 'ケヴィン・ケリー' })
    const c = makeBook({ title: '別の本', author: 'ケヴィン・ケリー' })

    expect(getBookIdentity(a)).toBe(getBookIdentity(b))
    expect(getBookIdentity(a)).not.toBe(getBookIdentity(c))
  })

  it('不正な URL でも例外を投げない', () => {
    const book = makeBook({ amazonUrl: 'not a url' })
    expect(() => getBookIdentity(book)).not.toThrow()
  })
})
