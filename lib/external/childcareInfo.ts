// 어린이집정보공개포털 / 유치원알리미 API 연동 (서버 전용)
// CHILDCARE_API_KEY(어린이집) · KINDERGARTEN_API_KEY(유치원) 미설정/실패 시 샘플 fallback.
//
// 주의: 실제 응답 필드/엔드포인트는 포털 명세에 따라 확인 필요.
//   - 응답 키는 대소문자 변형이 있어(La/la, Lo/lo, Crtelno/crtelno 등) 정규화 헬퍼로 흡수한다.
//   - 개인정보(유아 이름·진단명 등)는 저장/사용하지 않는다. 특수장애 아동수는 집계값만 사용.
import { USE_SAMPLE_FALLBACK, CHILDCARE_API_KEY, KINDERGARTEN_API_KEY } from '@/lib/env'
import type { InstitutionType } from '@/lib/types/db'

const TIMEOUT_MS = 5_000

/** 정규화된 기관 정보 (포털 API → 내부 구조). PII 미포함. */
export interface ChildcareInstitutionInfo {
  external_code: string | null // stcode
  name: string | null // crname
  type: InstitutionType
  type_name: string | null // crtypename
  status_name: string | null // crstatusname
  sido: string | null // sidoname
  sigungu: string | null // sigunguname
  zipcode: string | null
  address: string | null // craddr
  tel: string | null // crtelno
  homepage: string | null // crhome
  data_std_date: string | null // datastdrdt
  latitude: number | null // la
  longitude: number | null // lo
  capacity: number | null // crcapat 정원
  current_count: number | null // crchcnt 현원
  child_count_total: number | null // child_cnt_tot
  nursery_room_count: number | null // nrtrroomcnt
  playground_count: number | null // plgrdco
  cctv_count: number | null // cctvinstlcnt
  has_shuttle: boolean // crcargbname == '운영'
  // 파생 계산값 (집계값만)
  infant_total_count: number // 만0~2세 + 영아혼합
  preschool_total_count: number // 만3~5세 + 유아혼합
  special_support_count_api: number // child_cnt_sp
  class_count_total: number | null // class_cnt_tot
  // 교직원 현황 (집계값)
  staff_total: number | null // em_cnt_tot
  cook_count: number | null // em_cnt_a7 조리원
  nutritionist_count: number | null // em_cnt_a5 영양사
  nurse_count: number | null // em_cnt_a6 간호사
  nursing_assistant_count: number | null // em_cnt_a10 간호조무사
  special_teacher_count: number | null // em_cnt_a3 특수교사
  // 원본 보존
  raw: Record<string, unknown>
}

// ── 정규화 헬퍼 (대소문자 변형 흡수) ────────────────────────────────────────
function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] != null && o[k] !== '') return o[k]
    const lower = k.toLowerCase()
    const upper = k.charAt(0).toUpperCase() + k.slice(1)
    if (o[lower] != null && o[lower] !== '') return o[lower]
    if (o[upper] != null && o[upper] !== '') return o[upper]
  }
  return undefined
}
function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms)),
  ])
}

/** 포털 응답 1건 → ChildcareInstitutionInfo 정규화 */
export function normalizeChildcareItem(
  raw: Record<string, unknown>,
  type: InstitutionType
): ChildcareInstitutionInfo {
  const n = (k: string) => num(pick(raw, k))
  const infant =
    (n('child_cnt_00') ?? 0) + (n('child_cnt_01') ?? 0) + (n('child_cnt_02') ?? 0) + (n('child_cnt_m2') ?? 0)
  const preschool =
    (n('child_cnt_03') ?? 0) + (n('child_cnt_04') ?? 0) + (n('child_cnt_05') ?? 0) + (n('child_cnt_m5') ?? 0)
  const shuttle = String(pick(raw, 'crcargbname') ?? '').includes('운영')

  return {
    external_code: str(pick(raw, 'stcode')),
    name: str(pick(raw, 'crname')),
    type,
    type_name: str(pick(raw, 'crtypename')),
    status_name: str(pick(raw, 'crstatusname')),
    sido: str(pick(raw, 'sidoname')),
    sigungu: str(pick(raw, 'sigunguname')),
    zipcode: str(pick(raw, 'zipcode')),
    address: str(pick(raw, 'craddr')),
    tel: str(pick(raw, 'crtelno')),
    homepage: str(pick(raw, 'crhome')),
    data_std_date: str(pick(raw, 'datastdrdt')),
    latitude: num(pick(raw, 'la')),
    longitude: num(pick(raw, 'lo')),
    capacity: n('crcapat'),
    current_count: n('crchcnt'),
    child_count_total: n('child_cnt_tot'),
    nursery_room_count: n('nrtrroomcnt'),
    playground_count: n('plgrdco'),
    cctv_count: n('cctvinstlcnt'),
    has_shuttle: shuttle,
    infant_total_count: infant,
    preschool_total_count: preschool,
    special_support_count_api: n('child_cnt_sp') ?? 0,
    class_count_total: n('class_cnt_tot'),
    staff_total: n('em_cnt_tot'),
    cook_count: n('em_cnt_a7'),
    nutritionist_count: n('em_cnt_a5'),
    nurse_count: n('em_cnt_a6'),
    nursing_assistant_count: n('em_cnt_a10'),
    special_teacher_count: n('em_cnt_a3'),
    raw,
  }
}

/** 샘플 후보 (키 미설정/실패 시) */
function sampleCandidates(query: string): ChildcareInstitutionInfo[] {
  const base: Record<string, unknown> = {
    stcode: '11000000-000001',
    crname: query ? `${query}어린이집` : '햇살어린이집',
    crtypename: '민간',
    crstatusname: '정상',
    sidoname: '서울특별시',
    sigunguname: '강서구',
    zipcode: '07000',
    craddr: '서울특별시 강서구 화곡로 123',
    crtelno: '02-000-0000',
    la: 37.5478,
    lo: 126.8498,
    crcapat: 99,
    crchcnt: 80,
    child_cnt_tot: 80,
    child_cnt_00: 6, child_cnt_01: 7, child_cnt_02: 7,
    child_cnt_03: 20, child_cnt_04: 20, child_cnt_05: 20,
    child_cnt_sp: 0,
    class_cnt_tot: 8,
    crcargbname: '운영',
    em_cnt_tot: 14, em_cnt_a5: 1, em_cnt_a6: 0, em_cnt_a7: 2, em_cnt_a10: 0, em_cnt_a3: 0,
  }
  return [normalizeChildcareItem(base, 'daycare')]
}

/**
 * 기관명/코드로 어린이집·유치원 정보 조회.
 * @param query 검색어(기관명)
 * @param type  'daycare'(어린이집) | 'kindergarten'(유치원)
 * @param code  stcode 직접 조회(선택)
 */
export async function searchChildcareInstitutions(
  query: string,
  type: InstitutionType = 'daycare',
  code?: string | null
): Promise<{ data: ChildcareInstitutionInfo[]; source: 'api' | 'sample' }> {
  const apiKey = type === 'kindergarten' ? KINDERGARTEN_API_KEY : CHILDCARE_API_KEY
  if (USE_SAMPLE_FALLBACK || !apiKey) {
    return { data: sampleCandidates(query), source: 'sample' }
  }

  try {
    // TODO(실연동): 포털 실제 엔드포인트로 교체. 응답이 배열인지 response.body.items인지 확인 필요.
    const params = new URLSearchParams({ serviceKey: apiKey, returnType: 'json' })
    if (code) params.set('stcode', code)
    if (query) params.set('crname', query)
    const url = `https://api.childcare.go.kr/mediate/rest/cssp/childCareInfo?${params}`

    const res = await withTimeout(fetch(url), TIMEOUT_MS)
    if (!res.ok) throw new Error(`childcare HTTP ${res.status}`)
    const json = await res.json()
    // 응답 형태 방어적 처리: 배열 | response.body.items.item | items
    const items: Array<Record<string, unknown>> =
      (Array.isArray(json) && json) ||
      json?.response?.body?.items?.item ||
      json?.items ||
      json?.body ||
      []
    if (!Array.isArray(items) || items.length === 0) throw new Error('no items')
    return { data: items.map((it) => normalizeChildcareItem(it, type)), source: 'api' }
  } catch (err) {
    console.warn('[childcareInfo] fallback:', err)
    return { data: sampleCandidates(query), source: 'sample' }
  }
}
