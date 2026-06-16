// 행안부 긴급재난문자 조회 서비스 (서버 전용)
// MOIS_DISASTER_API_KEY 없거나 실패 시 샘플 3종 fallback
//
// V2 API 실제 응답 구조 (2026-06-15 검증):
//   {
//     "header": { "resultMsg": "NORMAL SERVICE", "resultCode": "00", "errorMsg": null },
//     "numOfRows": 5, "pageNo": 1, "totalCount": 52802,
//     "body": [
//       {
//         "MSG_CN": "...",          // 본문
//         "RCPTN_RGN_NM": "...",   // 수신지역명
//         "CRT_DT": "2023/09/19 12:22:17",  // 생성일시 (슬래시 형식)
//         "REG_YMD": "2023-09-19", // 등록일
//         "EMRG_STEP_NM": "안전안내", // 긴급단계명
//         "SN": 205355,             // 일련번호 (number 타입)
//         "DST_SE_NM": "기타",      // 재난구분명 (폭염/호우/기타 등)
//         "MDFCN_YMD": "2023-09-19"
//       }, ...
//     ]
//   }
//   * json.body 가 배열 (json.response.body.items 아님)
//   * SN 은 number
//   * DST_SE_NM 은 재난분류 키 (폭염/호우/침수/감염 등 키워드 포함)

import type { DisasterType } from '@/lib/disaster/types'
import { USE_SAMPLE_FALLBACK, MOIS_DISASTER_API_KEY } from '@/lib/env'
import {
  SAMPLE_HEATWAVE_MESSAGES,
  SAMPLE_HEAVY_RAIN_MESSAGES,
  SAMPLE_INFECTION_MESSAGES,
} from '@/lib/sample/disaster_messages'

const TIMEOUT_MS = 5_000

export interface DisasterSmsItem {
  id: string
  raw_text: string
  issued_at: string | null
  region: string | null
  disaster_type: DisasterType | 'other'
  source: 'api' | 'sample'
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms)),
  ])
}

/**
 * 행안부 V2 API 응답 항목을 재난유형으로 분류한다.
 *
 * 우선순위: DST_SE_NM 필드 키워드 → MSG_CN 본문 키워드 → 'other'
 * 실제 응답 확인 기준 (2026-06-15):
 *   - DST_SE_NM: "폭염", "호우", "감염병", "기타" 등
 *   - EMRG_STEP_NM: "폭염경보", "호우경보", "안전안내" 등
 */
export function classifyDisasterType(
  item: Record<string, unknown>
): DisasterType | 'other' {
  const dstSe = String(item.DST_SE_NM ?? '').trim()
  const emrgStep = String(item.EMRG_STEP_NM ?? '').trim()
  const msgCn = String(item.MSG_CN ?? '').trim()

  // 필드별 키워드 분류 (DST_SE_NM 우선)
  const combined = `${dstSe} ${emrgStep} ${msgCn}`

  // 폭염 키워드
  if (/폭염|고온|열사병|온열/.test(combined)) return 'heatwave'

  // 집중호우 키워드
  if (/호우|집중호우|침수|강우|홍수|태풍|하천|범람|저지대/.test(combined)) return 'heavy_rain'

  // 감염병 키워드
  if (/감염|확진|유행|전파|바이러스|방역|격리|코로나|독감|노로|살모넬라/.test(combined)) return 'infection'

  return 'other'
}

/**
 * 재난문자 원문 텍스트만으로 재난유형을 분류한다.
 * classifyDisasterType의 본문 키워드 분류를 재사용한다.
 * (S-C: 마법사에서 재난유형 수동 선택을 제거하고 자동 분류로 대체)
 */
export function classifyFromText(rawText: string): DisasterType | 'other' {
  return classifyDisasterType({ MSG_CN: rawText })
}

/**
 * CRT_DT 날짜 문자열(슬래시 형식 또는 ISO 형식)을 ISO 8601로 정규화.
 * 예: "2023/09/19 12:22:17" → "2023-09-19T12:22:17+09:00"
 */
function normalizeDateTime(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    // 슬래시 형식 "YYYY/MM/DD HH:mm:ss" → ISO 변환
    const cleaned = raw.replace('/', '-').replace('/', '-').replace(' ', 'T')
    // KST(+09:00) 시간대 추가 (API 응답이 KST 기준)
    if (!cleaned.includes('+') && !cleaned.includes('Z')) {
      return cleaned + '+09:00'
    }
    return cleaned
  } catch {
    return raw
  }
}

/**
 * 행안부 긴급재난문자 최근 목록 조회.
 *
 * @param sido - 시도명 필터 (예: '서울', '경기')
 * @param disasterType - 재난유형 필터. 지정 시 해당 유형만 반환 (classifyDisasterType 기준).
 *                       미지정 시 전체 반환.
 */
export async function fetchRecentDisasterSms(
  sido?: string | null,
  disasterType?: DisasterType | null
): Promise<DisasterSmsItem[]> {
  // 샘플 fallback: USE_SAMPLE_FALLBACK=true 또는 키 미설정
  if (USE_SAMPLE_FALLBACK || !MOIS_DISASTER_API_KEY) {
    return getSampleItems(sido, disasterType)
  }

  // 행안부 긴급재난문자 V2 API
  const params = new URLSearchParams({
    serviceKey: MOIS_DISASTER_API_KEY,
    numOfRows: '20',
    pageNo: '1',
    returnType: 'json',
    ...(sido ? { areaCode: sido } : {}),
  })

  const url = `https://www.safetydata.go.kr/V2/api/DSSP-IF-00247?${params}`

  try {
    const res = await withTimeout(fetch(url), TIMEOUT_MS)
    if (!res.ok) throw new Error(`MOIS HTTP ${res.status}`)

    const json = await res.json()

    // V2 응답: json.body 가 배열 (검증 완료 2026-06-15)
    const items: Array<Record<string, unknown>> = json?.body ?? []
    if (!Array.isArray(items) || items.length === 0) throw new Error('No items in body')

    // resultCode 확인 (헤더가 있는 경우)
    const resultCode = json?.header?.resultCode
    if (resultCode && resultCode !== '00') {
      throw new Error(`MOIS API error: ${json?.header?.resultMsg ?? resultCode}`)
    }

    const mapped: DisasterSmsItem[] = items.map((item) => ({
      // SN은 number 타입 — String() 변환 필요
      id: item.SN != null ? String(item.SN) : crypto.randomUUID(),
      raw_text: String(item.MSG_CN ?? ''),
      issued_at: normalizeDateTime(item.CRT_DT as string | null),
      region: String(item.RCPTN_RGN_NM ?? sido ?? '').trim() || null,
      disaster_type: classifyDisasterType(item),
      source: 'api' as const,
    }))

    // 재난유형 필터 (지정된 경우)
    const filtered = disasterType
      ? mapped.filter((m) => m.disaster_type === disasterType)
      : mapped

    // API에서 해당 유형 결과가 없으면 샘플 fallback
    if (filtered.length === 0) {
      console.warn(`[disasterSms] API 결과에서 '${disasterType}' 유형 없음 → 샘플 fallback`)
      return getSampleItems(sido, disasterType)
    }

    return filtered
  } catch (err) {
    console.warn('[disasterSms] fallback:', err)
    return getSampleItems(sido, disasterType)
  }
}

/** 샘플 데이터 반환 (재난유형 필터 적용) */
function getSampleItems(
  sido?: string | null,
  disasterType?: DisasterType | null
): DisasterSmsItem[] {
  // 폭염 + 집중호우 + 감염병 샘플 통합
  const allMessages = [
    ...SAMPLE_HEATWAVE_MESSAGES,
    ...SAMPLE_HEAVY_RAIN_MESSAGES,
    ...SAMPLE_INFECTION_MESSAGES,
  ]
  const all = allMessages.map((m) => ({
    id: m.id,
    raw_text: m.raw_text,
    issued_at: m.issued_at ?? null,
    region: sido ?? null,
    disaster_type: m.disaster_type as DisasterType | 'other',
    source: 'sample' as const,
  }))

  if (!disasterType) return all
  const filtered = all.filter((m) => m.disaster_type === disasterType)
  // 해당 유형 샘플 없으면 전체 반환 (시연 무중단)
  return filtered.length > 0 ? filtered : all
}
