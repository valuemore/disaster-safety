/**
 * components/admin/DisasterTypeSummary.tsx
 *
 * 재난유형별 대응계획 생성 건수 요약 (막대+뱃지 분포).
 * AdminStats.disaster_type_counts 또는 AdminPlanRow 배열에서 집계 가능.
 */

import { DISASTER_REGISTRY } from '@/lib/disaster/registry'
import type { DisasterType } from '@/lib/types/db'

// 재난유형별 색상 (Tailwind safe-list: 빌드 시 포함 보장)
const TYPE_COLOR: Record<DisasterType, string> = {
  heatwave: 'bg-orange-500',
  heavy_rain: 'bg-blue-500',
  infection: 'bg-emerald-500',
}

const TYPE_TEXT_COLOR: Record<DisasterType, string> = {
  heatwave: 'text-orange-700',
  heavy_rain: 'text-blue-700',
  infection: 'text-emerald-700',
}

const TYPE_BG_LIGHT: Record<DisasterType, string> = {
  heatwave: 'bg-orange-50',
  heavy_rain: 'bg-blue-50',
  infection: 'bg-emerald-50',
}

interface DisasterTypeSummaryProps {
  /** 재난유형별 건수 */
  counts: Partial<Record<DisasterType, number>>
}

export function DisasterTypeSummary({ counts }: DisasterTypeSummaryProps) {
  const disasterTypes: DisasterType[] = ['heatwave', 'heavy_rain', 'infection']
  const total = disasterTypes.reduce((sum, t) => sum + (counts[t] ?? 0), 0)

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground">생성된 대응계획이 없습니다.</p>
    )
  }

  return (
    <div className="space-y-3">
      {/* 건수 뱃지 행 */}
      <div className="flex flex-wrap gap-2">
        {disasterTypes.map((type) => {
          const count = counts[type] ?? 0
          const label = DISASTER_REGISTRY[type].label
          return (
            <span
              key={type}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${TYPE_BG_LIGHT[type]} ${TYPE_TEXT_COLOR[type]}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${TYPE_COLOR[type]}`}
                aria-hidden="true"
              />
              {label}
              <span className="font-bold tabular-nums">{count}건</span>
            </span>
          )
        })}
      </div>

      {/* 비율 막대 */}
      {total > 0 && (
        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`재난유형 분포: ${disasterTypes.map((t) => `${DISASTER_REGISTRY[t].label} ${counts[t] ?? 0}건`).join(', ')}`}
        >
          {disasterTypes.map((type) => {
            const count = counts[type] ?? 0
            if (count === 0) return null
            const pct = Math.round((count / total) * 100)
            return (
              <span
                key={type}
                className={`${TYPE_COLOR[type]} transition-all`}
                style={{ width: `${pct}%` }}
              />
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">전체 {total}건 기준</p>
    </div>
  )
}
