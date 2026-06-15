// 행안부 긴급재난문자 조회 서비스 (서버 전용)
// MOIS_DISASTER_API_KEY 없거나 실패 시 샘플 3종 fallback
import { USE_SAMPLE_FALLBACK, MOIS_DISASTER_API_KEY } from '@/lib/env'
import { SAMPLE_DISASTER_MESSAGES } from '@/lib/sample'

const TIMEOUT_MS = 5_000

export interface DisasterSmsItem {
  id: string
  raw_text: string
  issued_at: string | null
  region: string | null
  disaster_type: string
  source: 'api' | 'sample'
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms)),
  ])
}

export async function fetchRecentDisasterSms(sido?: string | null): Promise<DisasterSmsItem[]> {
  if (USE_SAMPLE_FALLBACK || !MOIS_DISASTER_API_KEY) {
    return SAMPLE_DISASTER_MESSAGES.map((m) => ({
      id: m.id,
      raw_text: m.raw_text,
      issued_at: m.issued_at ?? null,
      region: sido ?? null,
      disaster_type: m.disaster_type,
      source: 'sample' as const,
    }))
  }

  // 행안부 긴급재난문자 API
  // https://www.safetydata.go.kr/openApiMenu/selectOpenApiDetail.do
  const params = new URLSearchParams({
    serviceKey: MOIS_DISASTER_API_KEY,
    numOfRows: '10',
    pageNo: '1',
    returnType: 'json',
    ...(sido ? { areaCode: sido } : {}),
  })

  const url = `https://www.safetydata.go.kr/V2/api/DSSP-IF-00247?${params}`

  try {
    const res = await withTimeout(fetch(url), TIMEOUT_MS)
    if (!res.ok) throw new Error(`MOIS ${res.status}`)
    const json = await res.json()

    const items: Array<Record<string, string>> = json?.body ?? []
    if (!Array.isArray(items) || items.length === 0) throw new Error('No items')

    return items.map((item, i) => ({
      id: item.SN ?? String(i),
      raw_text: item.MSG_CN ?? '',
      issued_at: item.CRT_DT ?? null,
      region: item.RCPTN_RGN_NM ?? sido ?? null,
      disaster_type: 'heatwave',
      source: 'api' as const,
    }))
  } catch (err) {
    console.warn('[disasterSms] fallback:', err)
    return SAMPLE_DISASTER_MESSAGES.map((m) => ({
      id: m.id,
      raw_text: m.raw_text,
      issued_at: m.issued_at ?? null,
      region: sido ?? null,
      disaster_type: m.disaster_type,
      source: 'sample' as const,
    }))
  }
}
