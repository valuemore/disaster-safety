import { NextRequest, NextResponse } from 'next/server'
import { searchChildcareInstitutions } from '@/lib/external/childcareInfo'
import type { InstitutionType } from '@/lib/types/db'

/**
 * 어린이집·유치원 정보 검색 (GET ?q= &type= &code= &arcode=)
 * - arcode+code(stcode) → cpmsapi030 실 상세조회
 * - q(이름)만 → 목록 API 미승인으로 예시 후보 fallback
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const code = searchParams.get('code')
  const arcode = searchParams.get('arcode')
  const type = (searchParams.get('type') === 'kindergarten' ? 'kindergarten' : 'daycare') as InstitutionType

  if (!q && !code) {
    return NextResponse.json({ error: '검색어 또는 기관코드를 입력하세요.' }, { status: 400 })
  }

  const { data, source, error } = await searchChildcareInstitutions(q, type, code, arcode)
  return NextResponse.json({ data, source, error })
}
