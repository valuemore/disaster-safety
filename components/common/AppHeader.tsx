'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useRole } from '@/components/providers/RoleProvider'
import { Badge } from '@/components/ui/badge'

const NAV_ITEMS = [
  { href: '/', label: '홈', mobileLabel: '홈', alwaysShow: true },
  { href: '/institutions', label: '기관 관리', mobileLabel: null, alwaysShow: false },
  { href: '/plan/new', label: '대응계획 생성', mobileLabel: '계획', alwaysShow: true },
  { href: '/admin', label: '관리자', mobileLabel: '관리자', alwaysShow: true },
]

const ROLE_LABELS: Record<string, string> = {
  director: '원장',
  teacher: '담임교사',
  shuttle: '통학버스',
  admin: '지자체 관리자',
}

export function AppHeader() {
  const pathname = usePathname()
  const { role } = useRole()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 font-semibold">
          <span className="text-primary text-lg" aria-hidden="true">🌡️</span>
          <span className="text-sm font-bold">재난안전MVP</span>
        </Link>

        <div className="flex min-w-0 items-center gap-1.5">
          {role && (
            <Link href="/" aria-label="역할 변경">
              <Badge variant="secondary" className="hidden cursor-pointer text-xs sm:flex">
                {ROLE_LABELS[role] ?? role} 변경
              </Badge>
            </Link>
          )}

          <nav className="flex items-center gap-0.5" aria-label="메인 네비게이션">
            {NAV_ITEMS.map(({ href, label, mobileLabel, alwaysShow }) => {
              const isActive = pathname === href
              if (mobileLabel === null) {
                // 모바일에서 숨김
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'hidden rounded-md px-2.5 py-1.5 text-sm transition-colors sm:block',
                      isActive
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {label}
                  </Link>
                )
              }
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs transition-colors sm:px-2.5 sm:text-sm',
                    !alwaysShow && 'hidden sm:block',
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <span className="sm:hidden">{mobileLabel}</span>
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
