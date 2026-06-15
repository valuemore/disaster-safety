export default function PlanResultLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="flex items-center justify-center py-2 gap-2 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        대응계획 생성 중...
      </div>
    </div>
  )
}
