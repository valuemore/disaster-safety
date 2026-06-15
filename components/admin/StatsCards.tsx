import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminStats } from '@/lib/sample/admin'

const PRIORITY_COLOR = 'text-destructive'

interface StatsCardsProps {
  stats: AdminStats
  isSample?: boolean
}

interface StatItemProps {
  title: string
  value: number
  unit: string
  accent?: boolean
}

function StatItem({ title, value, unit, accent }: StatItemProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground font-normal">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold tabular-nums ${accent ? PRIORITY_COLOR : ''}`}>
          {value}
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        </p>
      </CardContent>
    </Card>
  )
}

export function StatsCards({ stats, isSample }: StatsCardsProps) {
  return (
    <div className="space-y-2">
      {isSample && (
        <p className="text-xs text-muted-foreground">샘플 데이터 기준</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <StatItem title="등록 기관" value={stats.institution_count} unit="곳" />
        <StatItem title="오늘 생성" value={stats.today_plan_count} unit="건" />
        <StatItem
          title="고위험"
          value={stats.high_priority_count}
          unit="건"
          accent={stats.high_priority_count > 0}
        />
      </div>
    </div>
  )
}
