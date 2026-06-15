import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DISASTER_REGISTRY } from '@/lib/disaster/registry'
import type { AdminPlanRow } from '@/lib/sample/admin'
import type { DisasterType } from '@/lib/types/db'

const PRIORITY_LABEL: Record<string, string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-green-600 text-white',
}

const ROLE_LABEL: Record<string, string> = {
  director: '원장',
  teacher: '담임교사',
  shuttle: '통학버스',
  admin: '관리자',
}

const DISASTER_TYPE_CLASS: Record<DisasterType, string> = {
  heatwave: 'bg-orange-100 text-orange-700',
  heavy_rain: 'bg-blue-100 text-blue-700',
  infection: 'bg-emerald-100 text-emerald-700',
}

function DisasterTypeBadge({ type }: { type?: DisasterType | null }) {
  if (!type) return null
  const entry = DISASTER_REGISTRY[type]
  if (!entry) return null
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${DISASTER_TYPE_CLASS[type]}`}>
      {entry.label}
    </span>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface RecentPlanListProps {
  plans: AdminPlanRow[]
  title?: string
  showInstitution?: boolean
}

export function RecentPlanList({
  plans,
  title = '최근 대응계획',
  showInstitution = true,
}: RecentPlanListProps) {
  if (plans.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">아직 생성된 대응계획이 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/plan/${plan.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                {/* 우선순위 배지 */}
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    PRIORITY_CLASS[plan.priority ?? 'low'] ?? 'bg-muted text-muted-foreground'
                  }`}
                >
                  {PRIORITY_LABEL[plan.priority ?? ''] ?? '-'}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {showInstitution && (
                      <p className="truncate text-sm font-medium">{plan.institution_name}</p>
                    )}
                    <DisasterTypeBadge type={plan.disaster_type} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{plan.disaster_summary}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABEL[plan.created_by_role ?? ''] ?? plan.created_by_role ?? '-'}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatTime(plan.created_at)}</span>
                    {plan.is_fallback && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-amber-600">샘플</span>
                      </>
                    )}
                  </div>
                </div>

                <span className="shrink-0 text-xs text-primary">열람 →</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
