import { Badge } from '@/components/ui/badge'
import type { DataSource } from '@/lib/db/withFallback'

interface FallbackBadgeProps {
  isFallback: boolean
  source?: DataSource
  className?: string
}

export function FallbackBadge({
  isFallback,
  source,
  className = '',
}: FallbackBadgeProps) {
  if (!isFallback && source !== 'sample') return null

  return (
    <Badge
      variant="secondary"
      className={`text-xs font-medium text-muted-foreground ${className}`}
    >
      샘플 결과
    </Badge>
  )
}
