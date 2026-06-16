import { NextRequest, NextResponse } from 'next/server'
import { searchChildcareInstitutions } from '@/lib/external/childcareInfo'
import type { InstitutionType } from '@/lib/types/db'

/** 어린이집·유치원 정보 검색 (GET ?q= &type= &code=) */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const code = searchParams.get('code')
  const type = (searchParams.get('type') === 'kindergarten' ? 'kindergarten' : 'daycare') as InstitutionType

  if (!q && !code) {
    return NextResponse.json({ error: '검색어를 입력하세요.' }, { status: 400 })
  }

  const { data, source } = await searchChildcareInstitutions(q, type, code)
  return NextResponse.json({ data, source })
}
