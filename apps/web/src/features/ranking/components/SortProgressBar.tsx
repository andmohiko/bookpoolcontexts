type SortProgressBarProps = {
  answered: number
  maxTotal: number
}

export const SortProgressBar = ({
  answered,
  maxTotal,
}: SortProgressBarProps) => {
  // maxTotal は最悪値なので、実際の回答数が上回らないよう念のため丸める
  const ratio = maxTotal > 0 ? Math.min(answered / maxTotal, 1) : 0

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={maxTotal}
        aria-label="ソートの進捗"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {answered} / 最大 {maxTotal}
      </span>
    </div>
  )
}
