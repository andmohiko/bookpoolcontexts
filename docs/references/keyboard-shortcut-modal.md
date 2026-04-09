## はじめに

Webアプリケーションでは、キーボードショートカットで特定のアクションを実行できると、操作効率が大幅に向上します。本ドキュメントでは、特定のキー（例: `c`）を押したときにモーダルを表示する実装手順を解説します。

## 目的

マウス操作なしで素早くモーダルを開けるようにすることで、ユーザーの操作効率を高めます。以下の要件を満たす実装を行います。

- 特定のキーを押すとモーダルが表示される
- テキスト入力中（input / textarea / contentEditable）は発火しない
- モーダルの開閉状態を適切に管理する
- ショートカットキーで開いた際に意図しない文字入力が発生しない

## 設計

### 構成要素

| 要素 | 役割 | ファイルパス |
|------|------|------------|
| `useKeyboardShortcut` | キーボードイベントの登録・解除、入力中の抑制 | `apps/web/src/hooks/useKeyboardShortcut.ts` |
| `useDisclosure` | モーダルの開閉状態管理 | `apps/web/src/hooks/useDisclosure.ts` |
| モーダルコンポーネント | 表示するモーダルUI | `apps/web/src/features/*/components/` |
| ページコンポーネント | フックとモーダルを組み合わせる | `apps/web/src/routes/` |

### 処理フロー

```
ユーザーがキーを押す
  │
  ▼
useKeyboardShortcut のイベントハンドラが発火
  │  キーが一致するか？ → No → 何もしない
  │  修飾キーが一致するか？ → No → 何もしない
  │  input/textarea/contentEditable にフォーカス中か？ → Yes → 何もしない
  │
  ▼
callback が実行される
  │  e.preventDefault() でデフォルト動作を抑制
  │  useDisclosure の open() を呼び出し
  │
  ▼
モーダルが表示される
  │  onOpenAutoFocus でフォーカス制御
  │  フォームをリセット（ショートカットキーの文字が入力されないように）
```

## 実装手順

### 1. useKeyboardShortcut フック

キーボードショートカットの登録・解除を管理するカスタムフックです。

```typescript
import { useEffect } from 'react'

type Options = {
  meta?: boolean
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
}

export const useKeyboardShortcut = (
  key: string,
  callback: (e: KeyboardEvent) => void,
  options: Options = {},
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== key) return
      if (!!options.meta !== e.metaKey) return
      if (!!options.ctrl !== e.ctrlKey) return
      if (!!options.alt !== e.altKey) return
      if (!!options.shift !== e.shiftKey) return

      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      callback(e)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, callback, options.meta, options.ctrl, options.alt, options.shift])
}
```

**設計ポイント:**

- **入力中の抑制**: `INPUT`、`TEXTAREA`、`contentEditable` にフォーカスがある場合はイベントを無視する。これにより、テキスト入力中に誤ってモーダルが開くことを防ぐ
- **修飾キーの厳密チェック**: `!!options.meta !== e.metaKey` のように、オプション未指定（`undefined`）を `false` に変換して比較する。これにより「Cmd+C」と「C」を区別できる
- **クリーンアップ**: `useEffect` の戻り値でイベントリスナーを解除し、メモリリークを防ぐ

### 2. useDisclosure フック

モーダルの開閉状態をカプセル化するフックです。

```typescript
import { useCallback, useState } from 'react'

type UseDisclosureReturn = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useDisclosure = (initialState = false): UseDisclosureReturn => {
  const [isOpen, setIsOpen] = useState(initialState)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  return { isOpen, open, close, toggle }
}
```

**設計ポイント:**

- **useCallback でメモ化**: `open`・`close`・`toggle` をメモ化することで、不要な再レンダリングを防ぐ。これは `useKeyboardShortcut` に渡すコールバックの依存配列が安定することにも寄与する

### 3. モーダルコンポーネント

Radix UI の Dialog を使用してモーダルを実装します。`open` と `onClose` を props で受け取る制御コンポーネントとして設計します。

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CreateNoteModalProps = {
  open: boolean
  onClose: () => void
}

export const CreateNoteModal = ({ open, onClose }: CreateNoteModalProps) => {
  const handleOpenAutoFocus = (e: Event) => {
    e.preventDefault()
    // ショートカットキーで開いた際に入力された文字をクリアするため、
    // フォームを再マウントしてから本文テキストエリアにフォーカスする
    setTimeout(() => {
      document.getElementById('content')?.focus()
    }, 0)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onOpenAutoFocus={handleOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle>メモを作成</DialogTitle>
          <DialogDescription className="sr-only">
            新しいメモを作成します
          </DialogDescription>
        </DialogHeader>
        {/* フォーム内容 */}
      </DialogContent>
    </Dialog>
  )
}
```

**設計ポイント:**

- **`onOpenAutoFocus` の制御**: ショートカットキー（例: `c`）でモーダルを開いた場合、キー入力がフォームのテキストエリアに伝播して「c」が入力されてしまう。`e.preventDefault()` でデフォルトのフォーカス動作を抑制し、`setTimeout` で次のイベントループまで遅延させてからフォーカスを当てることで、この問題を回避する
- **`onOpenChange` でのクローズ制御**: `onOpenChange` は `open` が `false` になるとき（オーバーレイクリックや Escape キー押下時）に呼ばれる。`!open && onClose()` とすることで、閉じる方向のみハンドリングする

### 4. ページコンポーネントでの組み合わせ

フックとモーダルを組み合わせて、キーボードショートカットでモーダルを表示します。

```typescript
import { useCallback } from 'react'
import { CreateNoteModal } from '@/features/notes/components/CreateNoteModal'
import { useDisclosure } from '@/hooks/useDisclosure'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'

function HomePage() {
  const {
    isOpen: isCreateModalOpen,
    open: openCreateModal,
    close: closeCreateModal,
  } = useDisclosure()

  useKeyboardShortcut(
    'c',
    useCallback(
      (e) => {
        e.preventDefault()
        openCreateModal()
      },
      [openCreateModal],
    ),
  )

  return (
    <main>
      {/* ページコンテンツ */}
      <CreateNoteModal open={isCreateModalOpen} onClose={closeCreateModal} />
    </main>
  )
}
```

**設計ポイント:**

- **`useCallback` でコールバックをメモ化**: `useKeyboardShortcut` に渡すコールバックを `useCallback` でラップし、依存配列に `openCreateModal` を含める。`useDisclosure` の `open` は `useCallback` でメモ化されているため、コールバックの参照が安定する
- **`e.preventDefault()`**: ブラウザのデフォルト動作（例: `Cmd+S` での保存ダイアログ）を抑制する。単一キーの場合は必須ではないが、慣習的に含めておく

## 修飾キー付きショートカットの例

`Cmd+K` や `Ctrl+Shift+N` のような修飾キー付きのショートカットも `options` パラメータで対応できます。

```typescript
// Cmd+K で検索モーダルを開く
useKeyboardShortcut(
  'k',
  useCallback(
    (e) => {
      e.preventDefault()
      openSearchModal()
    },
    [openSearchModal],
  ),
  { meta: true }, // Cmd キー必須
)

// Ctrl+Shift+N で新規作成
useKeyboardShortcut(
  'N',
  useCallback(
    (e) => {
      e.preventDefault()
      openCreateModal()
    },
    [openCreateModal],
  ),
  { ctrl: true, shift: true },
)
```

## 注意事項

### ブラウザのデフォルトショートカットとの競合

`Cmd+C`（コピー）、`Cmd+V`（ペースト）などのブラウザ標準ショートカットと競合するキーは避けてください。単一キー（修飾キーなし）のショートカットは、テキスト入力中は自動的に無効化されますが、ブラウザのアクセシビリティ機能と競合する可能性があります。

### モーダルが開いている間のショートカット

モーダルが開いている間もショートカットは有効です。モーダル内のテキスト入力にフォーカスがあれば自動的に抑制されますが、フォーカスが外れた状態でキーを押すと再度発火します。必要に応じて、モーダルが開いている間はショートカットを無効化する制御を追加してください。

```typescript
useKeyboardShortcut(
  'c',
  useCallback(
    (e) => {
      if (isCreateModalOpen) return // モーダルが開いている間は無視
      e.preventDefault()
      openCreateModal()
    },
    [isCreateModalOpen, openCreateModal],
  ),
)
```

### SSR環境での注意

`useKeyboardShortcut` は `window.addEventListener` を使用しているため、SSR環境では `useEffect` 内でのみ実行されます。TanStack StartのSPAモードでは問題になりませんが、SSRモードに移行する場合は `typeof window !== 'undefined'` のガードが必要になることがあります。
