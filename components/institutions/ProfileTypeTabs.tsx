'use client'

import Link from 'next/link'
import type { DisasterType } from '@/lib/disaster/types'

interface TabConfig {
  type: DisasterType
  label: string
  /** false이면 "준비 중" 표시하고 비활성 처리 */
  enabled: boolean
}

// T9-3: heavy_rain enabled:true 전환 완료
// T10-3: infection enabled:true 전환 완료
const TABS: TabConfig[] = [
  { type: 'heatwave', label: '폭염', enabled: true },
  { type: 'heavy_rain', label: '집중호우', enabled: true },
  { type: 'infection', label: '감염병', enabled: true },
]

interface ProfileTypeTabsProps {
  institutionId: string
  currentType: DisasterType
}

export function ProfileTypeTabs({ institutionId, currentType }: ProfileTypeTabsProps) {
  return (
    <div
      className="flex rounded-lg border bg-muted p-1 gap-1"
      role="tablist"
      aria-label="재난유형별 프로필"
    >
      {TABS.map(({ type, label, enabled }) => {
        const isActive = currentType === type
        const href = `/institutions/${institutionId}/profile?disaster_type=${type}`

        if (!enabled) {
          return (
            <span
              key={type}
              role="tab"
              aria-selected={false}
              aria-disabled="true"
              className="flex-1 rounded-md py-2 text-center text-sm font-medium text-muted-foreground/50 cursor-not-allowed select-none"
              title="준비 중"
            >
              {label}
              <span className="ml-1 text-xs">(준비 중)</span>
            </span>
          )
        }

        return (
          <Link
            key={type}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={`flex-1 rounded-md py-2 text-center text-sm font-medium transition-colors ${
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
