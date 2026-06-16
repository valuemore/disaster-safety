// 어린이집정보공개포털 API 연동 (서버 전용)
// 실 엔드포인트: cpmsapi030(어린이집 상세) — http://api.childcare.go.kr/mediate/rest/cpmsapi030/cpmsapi030/request
//   - 인증: ?key=CHILDCARE_API_KEY (서버 전용)
//   - 필수 파라미터: arcode(지역코드) + stcode(어린이집코드) → 상세 1건 반환(XML)
//   - arcode만 주면 필드 레이아웃 가이드 템플릿(값이 '01'~'62')을 반환 → 실데이터 아님으로 처리
// 응답 필드 케이스가 혼재: 헤더(소문자: crname, crcapat, la/lo 등) + 카운트(대문자: CHILD_CNT_00, EM_CNT_A1 등).
//
// 참고: 이름 검색(목록)은 cpmsapi003가 필요하나 현 키는 미승인(INFO-100). 코드 기반 상세조회만 실연동 가능.
// 키 미설정/실패/가이드응답 시 예시 후보 fallback.
//
// 개인정보: 개별 유아 이름·진단명 미저장. 특수장애 아동수는 집계값만 사용.
import { USE_SAMPLE_FALLBACK, CHILDCARE_API_KEY, KINDERGARTEN_API_KEY } from '@/lib/env'
import type { InstitutionType } from '@/lib/types/db'

const TIMEOUT_MS = 8_000
const CPMSAPI030_URL = 'http://api.childcare.go.kr/mediate/rest/cpmsapi030/cpmsapi030/request'

/** 정규화된 기관 정보 (포털 API → 내부 구조). PII 미포함. */
export interface ChildcareInstitutionInfo {
  external_code: string | null // stcode
  name: string | null // crname
  type: InstitutionType
  type_name: string | null // crtypename
  status_name: string | null // crstatusname
  sido: string | null // sidoname
  sigungu: string | null // sigunname
  zipcode: string | null
  address: string | null // craddr
  tel: string | null // crtelno
  homepage: string | null // crhome
  data_std_date: string | null // datastdrdt
  latitude: number | null // la
  longitude: number | null // lo
  capacity: number | null // crcapat 정원
  current_count: number | null // crchcnt 현원
  child_count_total: number | null // CHILD_CNT_TOT
  nursery_room_count: number | null // nrtrroomcnt
  playground_count: number | null // plgrdco
  cctv_count: number | null // cctvinstlcnt
  has_shuttle: boolean // crcargbname == '운영'
  // 파생 계산값 (집계값만)
  infant_total_count: number // 만0~2세 + 영아혼합
  preschool_total_count: number // 만3~5세 + 유아혼합
  special_support_count_api: number // CHILD_CNT_SP
  class_count_total: number | null // CLASS_CNT_TOT
  // 교직원 현황 (집계값)
  staff_total: number | null // EM_CNT_TOT
  cook_count: number | null // EM_CNT_A7 조리원
  nutritionist_count: number | null // EM_CNT_A5 영양사
  nurse_count: number | null // EM_CNT_A6 간호사
  nursing_assistant_count: number | null // EM_CNT_A10 간호조무사
  special_teacher_count: number | null // EM_CNT_A3 특수교사
  // 원본 보존
  raw: Record<string, unknown>
}

// ── 정규화 헬퍼 (대/소문자 변형 흡수) ───────────────────────────────────────
function pick(o: Record<string, unknown>, key: string): unknown {
  const variants = [
    key,
    key.toLowerCase(),
    key.toUpperCase(),
    key.charAt(0).toUpperCase() + key.slice(1),
  ]
  for (const k of variants) {
    if (o[k] != null && o[k] !== '') return o[k]
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

// ── XML 파싱 (flat <item> 구조) ─────────────────────────────────────────────
/** <response><item>...</item>...</response> → 필드 맵 배열 */
export function parseChildcareXml(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    const body = m[1]
    const fields: Record<string, string> = {}
    const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g
    let f: RegExpExecArray | null
    while ((f = fieldRe.exec(body)) !== null) {
      fields[f[1]] = f[2].trim()
    }
    items.push(fields)
  }
  return items
}

/** XML 오류 응답에서 errmsg 추출 (없으면 null) */
function xmlError(xml: string): string | null {
  return (xml.match(/<errmsg>([\s\S]*?)<\/errmsg>/) || [])[1] ?? null
}

/**
 * cpmsapi030 응답이 '필드 레이아웃 가이드 템플릿'인지 판별.
 * (arcode만 주거나 stcode 불일치 시 값이 '01','02'... 순번으로 채워진 예시가 반환됨)
 */
function isGuideTemplate(item: Record<string, string>): boolean {
  return item.crname === '04' || item.sidoname === '01' || item.stcode === '03'
}

/** 포털 응답 1건 → ChildcareInstitutionInfo 정규화 */
export function normalizeChildcareItem(
  raw: Record<string, unknown>,
  type: InstitutionType
): ChildcareInstitutionInfo {
  const n = (k: string) => num(pick(raw, k))
  const infant =
    (n('CHILD_CNT_00') ?? 0) + (n('CHILD_CNT_01') ?? 0) + (n('CHILD_CNT_02') ?? 0) + (n('CHILD_CNT_M2') ?? 0)
  const preschool =
    (n('CHILD_CNT_03') ?? 0) + (n('CHILD_CNT_04') ?? 0) + (n('CHILD_CNT_05') ?? 0) + (n('CHILD_CNT_M5') ?? 0)
  const shuttle = String(pick(raw, 'crcargbname') ?? '').includes('운영')

  return {
    external_code: str(pick(raw, 'stcode')),
    name: str(pick(raw, 'crname')),
    type,
    type_name: str(pick(raw, 'crtypename')),
    status_name: str(pick(raw, 'crstatusname')),
    sido: str(pick(raw, 'sidoname')),
    sigungu: str(pick(raw, 'sigunname')),
    zipcode: str(pick(raw, 'zipcode')),
    address: str(pick(raw, 'craddr')),
    tel: str(pick(raw, 'crtelno')),
    homepage: str(pick(raw, 'crhome')),
    data_std_date: str(pick(raw, 'datastdrdt')),
    latitude: num(pick(raw, 'la')),
    longitude: num(pick(raw, 'lo')),
    capacity: n('crcapat'),
    current_count: n('crchcnt'),
    child_count_total: n('CHILD_CNT_TOT'),
    nursery_room_count: n('nrtrroomcnt'),
    playground_count: n('plgrdco'),
    cctv_count: n('cctvinstlcnt'),
    has_shuttle: shuttle,
    infant_total_count: infant,
    preschool_total_count: preschool,
    special_support_count_api: n('CHILD_CNT_SP') ?? 0,
    class_count_total: n('CLASS_CNT_TOT'),
    staff_total: n('EM_CNT_TOT'),
    cook_count: n('EM_CNT_A7'),
    nutritionist_count: n('EM_CNT_A5'),
    nurse_count: n('EM_CNT_A6'),
    nursing_assistant_count: n('EM_CNT_A10'),
    special_teacher_count: n('EM_CNT_A3'),
    raw,
  }
}

/** 샘플 후보 (키 미설정/실패/가이드응답 시) */
function sampleCandidates(query: string): ChildcareInstitutionInfo[] {
  const base: Record<string, unknown> = {
    stcode: '11000000-000001',
    crname: query ? `${query}어린이집` : '햇살어린이집',
    crtypename: '민간',
    crstatusname: '정상',
    sidoname: '서울특별시',
    sigunname: '강서구',
    zipcode: '07000',
    craddr: '서울특별시 강서구 화곡로 123',
    crtelno: '02-000-0000',
    la: 37.5478,
    lo: 126.8498,
    crcapat: 99,
    crchcnt: 80,
    CHILD_CNT_TOT: 80,
    CHILD_CNT_00: 6, CHILD_CNT_01: 7, CHILD_CNT_02: 7,
    CHILD_CNT_03: 20, CHILD_CNT_04: 20, CHILD_CNT_05: 20,
    CHILD_CNT_SP: 0,
    CLASS_CNT_TOT: 8,
    crcargbname: '운영',
    EM_CNT_TOT: 14, EM_CNT_A5: 1, EM_CNT_A6: 0, EM_CNT_A7: 2, EM_CNT_A10: 0, EM_CNT_A3: 0,
  }
  return [normalizeChildcareItem(base, 'daycare')]
}

/**
 * 어린이집 상세 조회 (cpmsapi030) — arcode + stcode 필수.
 * 키 미설정/실패/가이드템플릿/오류 시 null 반환(호출부에서 fallback).
 */
export async function fetchChildcareByCode(
  arcode: string,
  stcode: string,
  type: InstitutionType = 'daycare'
): Promise<{ data: ChildcareInstitutionInfo | null; source: 'api' | 'sample'; error?: string }> {
  const apiKey = type === 'kindergarten' ? KINDERGARTEN_API_KEY : CHILDCARE_API_KEY
  if (USE_SAMPLE_FALLBACK || !apiKey) {
    return { data: sampleCandidates('')[0], source: 'sample' }
  }
  try {
    const params = new URLSearchParams({ key: apiKey, arcode, stcode })
    const res = await withTimeout(fetch(`${CPMSAPI030_URL}?${params}`), TIMEOUT_MS)
    if (!res.ok) throw new Error(`cpmsapi030 HTTP ${res.status}`)
    const xml = await res.text()
    const err = xmlError(xml)
    if (err) return { data: null, source: 'sample', error: err }
    const items = parseChildcareXml(xml)
    const real = items.find((it) => !isGuideTemplate(it))
    if (!real) {
      return { data: null, source: 'sample', error: 'guide_template_only' }
    }
    return { data: normalizeChildcareItem(real, type), source: 'api' }
  } catch (e) {
    console.warn('[childcareInfo] fetchByCode fallback:', e)
    return { data: null, source: 'sample', error: (e as Error).message }
  }
}

/**
 * 기관 검색.
 * - arcode+code(stcode)가 있으면 cpmsapi030 실 상세조회.
 * - 이름(query)만 있으면 목록 API(cpmsapi003) 미승인으로 실검색 불가 → 예시 후보 fallback.
 */
export async function searchChildcareInstitutions(
  query: string,
  type: InstitutionType = 'daycare',
  code?: string | null,
  arcode?: string | null
): Promise<{ data: ChildcareInstitutionInfo[]; source: 'api' | 'sample'; error?: string }> {
  if (arcode && code) {
    const r = await fetchChildcareByCode(arcode, code, type)
    if (r.data) return { data: [r.data], source: 'api' }
    return { data: sampleCandidates(query), source: 'sample', error: r.error }
  }
  // 이름 검색은 목록 API 필요(현 키 미승인) → 예시 후보
  return { data: sampleCandidates(query), source: 'sample', error: 'list_api_unavailable' }
}
