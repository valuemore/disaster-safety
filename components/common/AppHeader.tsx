'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSession } from '@/components/providers/SessionProvider'
import { Badge } from '@/components/ui/badge'

const NAV_ITEMS = [
  { href: '/plan/new/message', label: '대응계획 생성', mobileLabel: '계획' },
  { href: '/account/contacts', label: '담당자 연락처', mobileLabel: '연락처' },
]

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { institution, logout } = useSession()

  // 로그인/등록/공유 화면에서는 네비게이션 최소화
  const isAuthScreen =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/' ||
    pathname.startsWith('/share')

  async function handleLogout() {
    await logout()
    toast.success('로그아웃되었습니다.')
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3">
        <Link
          href={institution ? '/plan/new/message' : '/'}
          className="flex shrink-0 items-center gap-1.5 font-semibold"
        >
          <span className="text-primary text-lg" aria-hidden="true">🛟</span>
          <span className="text-sm font-bold">재난안전MVP</span>
        </Link>

        <div className="flex min-w-0 items-center gap-1.5">
          {institution && !isAuthScreen && (
            <nav className="flex items-center gap-0.5" aria-label="메인 네비게이션">
              {NAV_ITEMS.map(({ href, label, mobileLabel }) => {
                const isActive = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-xs transition-colors sm:px-2.5 sm:text-sm',
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
          )}

          {institution ? (
            <>
              <Badge variant="secondary" className="hidden max-w-[160px] truncate text-xs sm:flex">
                {institution.name}
              </Badge>
              <button
                onClick={handleLogout}
                className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
              >
                로그아웃
              </button>
            </>
          ) : (
            !isAuthScreen && (
              <Link
                href="/login"
                className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                로그인
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  )
}
