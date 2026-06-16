import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'

/**
 * Next.js 16 Proxy (구 Middleware).
 *
 * 보호경로(로그인 필요) 낙관적 가드만 수행한다 — 쿠키 존재 여부만 확인.
 * 서명 실검증은 각 Route Handler / Server Component에서 getSession()으로 수행.
 *
 * matcher로 지정한 경로(아래 config)에만 실행되므로
 * /login, /register, /share/**, /admin/**, /api/** 등은 자체적으로 제외된다.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  // 로그인 필요한 페이지 경로만 가드. (공개: /, /login, /register, /share, /admin, /api)
  matcher: ['/plan/:path*', '/account/:path*', '/institutions/:path*'],
}
