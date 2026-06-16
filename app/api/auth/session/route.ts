import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

/** 현재 로그인 세션 정보 반환 (클라이언트 헤더/가드용) */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ data: null })
  }
  return NextResponse.json({ data: { id: session.iid, name: session.name } })
}
