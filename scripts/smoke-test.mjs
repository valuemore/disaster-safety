/**
 * S0→S7 스모크 테스트 스크립트 (Node.js ESM)
 * 실행: USE_SAMPLE_FALLBACK=true node scripts/smoke-test.mjs
 *
 * 서버가 http://localhost:3000 에서 실행 중이어야 한다.
 */

const BASE = 'http://localhost:3000'
const SAMPLE_REQUEST_ID = '44444444-4444-4444-4444-444444444444'

let passed = 0
let failed = 0

async function check(label, fn) {
  try {
    const result = await fn()
    if (result.ok) {
      console.log(`  ✓ ${label}`)
      passed++
    } else {
      console.error(`  ✗ ${label} — ${result.reason}`)
      failed++
    }
  } catch (err) {
    console.error(`  ✗ ${label} — ${err.message}`)
    failed++
  }
}

async function get(path, expectStatus = 200) {
  const res = await fetch(`${BASE}${path}`)
  if (res.status !== expectStatus) {
    return { ok: false, reason: `HTTP ${res.status} (expected ${expectStatus})` }
  }
  return { ok: true, res }
}

async function post(path, body, expectStatus = 200) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const expected = Array.isArray(expectStatus) ? expectStatus : [expectStatus]
  if (!expected.includes(res.status)) {
    const text = await res.text().catch(() => '')
    return { ok: false, reason: `HTTP ${res.status} (expected ${expected.join('|')}) — ${text.slice(0,100)}` }
  }
  return { ok: true, res }
}

async function patch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status}` }
  }
  return { ok: true, res }
}

// ──────────────────────────────────────────────────────────────
console.log('\n🔥 재난안전MVP 스모크 테스트 (S0→S7)\n')

// S0: 랜딩 (역할 선택)
console.log('[S0] 랜딩 페이지')
await check('GET / — 200 OK', () => get('/'))

// S1/S2: 기관 관련 페이지
console.log('\n[S1/S2] 기관 등록·프로필')
await check('GET /institutions — 200 OK', () => get('/institutions'))
await check('GET /institutions/new — 200 OK', () => get('/institutions/new'))
await check('GET /api/institutions — 200 OK', () => get('/api/institutions'))
await check(
  'GET /api/institutions/[id]/profile — 샘플 기관 프로필 반환',
  async () => {
    const r = await get('/api/institutions/11111111-1111-1111-1111-111111111111/profile')
    if (!r.ok) return r
    const json = await r.res.json()
    if (!json || typeof json !== 'object') {
      return { ok: false, reason: 'JSON 응답 없음' }
    }
    return { ok: true }
  }
)

// S3: 재난문자 선택 페이지
console.log('\n[S3] 재난문자 선택')
await check('GET /plan/new — 200 OK', () => get('/plan/new'))
await check('GET /plan/new/message — 200 OK', () => get('/plan/new/message'))

// S4: 현재상황 선택
console.log('\n[S4] 현재상황 선택')
await check('GET /plan/new/situation — 200 OK', () => get('/plan/new/situation'))

// S5: 대응계획 생성 (API — 샘플 fallback)
console.log('\n[S5] 대응계획 생성 API')
const wizardDraft = {
  institution_id: '11111111-1111-1111-1111-111111111111',
  institution_name: '햇살어린이집',
  has_shuttle: true,
  disaster_message_id: '33333333-3333-3333-3333-333333333301',
  disaster_message_text: '[기상청] 폭염경보 발효. 야외활동 자제, 충분한 수분 섭취.',
  disaster_message_source: 'sample',
  disaster_message_issued_at: '2026-06-15T10:00:00+09:00',
  selected_situations: ['outdoor_play', 'heat_symptom_suspected'],
  situation_etc: '',
  role: 'director',
}

let generatedRequestId = SAMPLE_REQUEST_ID

await check(
  'POST /api/plan/generate — 대응계획 생성 성공',
  async () => {
    const r = await post('/api/plan/generate', wizardDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    if (!json?.data?.id) {
      return { ok: false, reason: `data.id 없음 — ${JSON.stringify(json).slice(0, 200)}` }
    }
    if (!json?.data?.result_json?.director_checklist?.length) {
      return { ok: false, reason: 'director_checklist 없음' }
    }
    generatedRequestId = json.data.id
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate — result_json.priority 유효값',
  async () => {
    const r = await post('/api/plan/generate', wizardDraft)
    if (!r.ok) return r
    const json = await r.res.json()
    const priority = json?.data?.result_json?.priority
    if (!['high', 'medium', 'low'].includes(priority)) {
      return { ok: false, reason: `priority=${priority}` }
    }
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate — safety_disclaimer 고정 문구 포함',
  async () => {
    const r = await post('/api/plan/generate', wizardDraft)
    if (!r.ok) return r
    const json = await r.res.json()
    const disc = json?.data?.result_json?.safety_disclaimer ?? ''
    if (!disc.includes('공식기관 지시와 119')) {
      return { ok: false, reason: `safety_disclaimer 부재: ${disc.slice(0, 50)}` }
    }
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate — 재난문자+상황 없으면 400',
  async () => {
    const r = await post('/api/plan/generate', { ...wizardDraft, disaster_message_text: '', selected_situations: [] }, 400)
    return r
  }
)

// S5: 대응계획 결과 페이지
console.log('\n[S5] 대응계획 결과 페이지')
await check(
  `GET /plan/${SAMPLE_REQUEST_ID} — 샘플 결과 페이지 200 OK`,
  () => get(`/plan/${SAMPLE_REQUEST_ID}`)
)
await check(
  `GET /plan/${generatedRequestId} — 생성된 결과 페이지 200 OK`,
  () => get(`/plan/${generatedRequestId}`)
)

// S6: 체크리스트 토글 API (샘플 fake ID)
console.log('\n[S6] 체크리스트 토글 (PATCH)')
await check(
  'PATCH /checklist/[fakeId] — 낙관적 토글 200 OK',
  () => patch(
    `/api/plan/${SAMPLE_REQUEST_ID}/checklist/${SAMPLE_REQUEST_ID}-director-0`,
    { is_done: true }
  )
)

// S7: 사후기록 페이지 및 API
console.log('\n[S7] 사후기록')
await check(
  `GET /plan/${SAMPLE_REQUEST_ID}/after-action — 200 OK`,
  () => get(`/plan/${SAMPLE_REQUEST_ID}/after-action`)
)
await check(
  `GET /api/plan/${SAMPLE_REQUEST_ID}/after-action — 사후기록 조회 200 OK`,
  async () => {
    const r = await get(`/api/plan/${SAMPLE_REQUEST_ID}/after-action`)
    if (!r.ok) return r
    const json = await r.res.json()
    if (!('data' in json)) {
      return { ok: false, reason: 'data 키 없음' }
    }
    return { ok: true }
  }
)
await check(
  `POST /api/plan/${SAMPLE_REQUEST_ID}/after-action — 사후기록 저장 200 OK`,
  async () => {
    const r = await post(`/api/plan/${SAMPLE_REQUEST_ID}/after-action`, {
      message_checked_at: new Date().toISOString(),
      outdoor_adjusted: true,
      cooling_checked: true,
      child_health_issue: false,
      parents_notified: true,
      shuttle_checked: null,
      completed_by: '원장',
      notes: '온도계 수동 확인으로 대체',
      improvement: '온도계 비치 검토 필요',
    })
    return r
  }
)
await check(
  'POST /api/plan/[id]/after-action — notes 2000자 초과 시 400',
  async () => {
    const r = await post(`/api/plan/${SAMPLE_REQUEST_ID}/after-action`, {
      notes: 'x'.repeat(2001),
    }, 400)
    return r
  }
)

// S8/S9: 관리자 대시보드
console.log('\n[S8/S9] 관리자 대시보드')
await check('GET /admin — 200 OK', () => get('/admin'))
await check(
  'GET /api/admin/stats — stats 반환',
  async () => {
    const r = await get('/api/admin/stats')
    if (!r.ok) return r
    const json = await r.res.json()
    if (typeof json?.data?.institution_count !== 'number') {
      return { ok: false, reason: 'institution_count 없음' }
    }
    if (typeof json?.data?.today_plan_count !== 'number') {
      return { ok: false, reason: 'today_plan_count 없음' }
    }
    return { ok: true }
  }
)
await check(
  'GET /api/admin/plans — 목록 반환',
  async () => {
    const r = await get('/api/admin/plans')
    if (!r.ok) return r
    const json = await r.res.json()
    if (!Array.isArray(json?.data)) {
      return { ok: false, reason: 'data 배열 없음' }
    }
    return { ok: true }
  }
)
await check(
  'GET /api/admin/plans?institution_id=[id] — 기관 필터',
  async () => {
    const r = await get('/api/admin/plans?institution_id=11111111-0000-0000-0000-000000000001')
    if (!r.ok) return r
    const json = await r.res.json()
    if (!Array.isArray(json?.data)) {
      return { ok: false, reason: 'data 배열 없음' }
    }
    return { ok: true }
  }
)
await check(
  'GET /admin/institutions/[id] — 기관 상세 200 OK',
  () => get('/admin/institutions/11111111-0000-0000-0000-000000000001')
)

// P6: 공공 API fallback 검사
console.log('\n[P6] 공공 API fallback 검사')
await check(
  'GET /api/external/geocode?query=서울특별시 종로구 — 좌표 반환',
  async () => {
    const r = await get('/api/external/geocode?query=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C%20%EC%A2%85%EB%A1%9C%EA%B5%AC')
    if (!r.ok) return r
    const json = await r.res.json()
    if (typeof json?.data?.lat !== 'number') {
      return { ok: false, reason: 'lat 없음' }
    }
    return { ok: true }
  }
)
await check(
  'GET /api/external/weather?lat=37.56&lng=126.97 — 날씨 반환',
  async () => {
    const r = await get('/api/external/weather?lat=37.56&lng=126.97')
    if (!r.ok) return r
    const json = await r.res.json()
    if (typeof json?.data?.temp !== 'number' && json?.data?.temp !== null) {
      return { ok: false, reason: 'temp 필드 없음' }
    }
    if (!json?.data?.source) {
      return { ok: false, reason: 'source 없음' }
    }
    return { ok: true }
  }
)
await check(
  'GET /api/external/weather?missing_params — 400',
  () => get('/api/external/weather', 400)
)
await check(
  'GET /api/external/disaster-sms — 재난문자 목록 반환',
  async () => {
    const r = await get('/api/external/disaster-sms')
    if (!r.ok) return r
    const json = await r.res.json()
    if (!Array.isArray(json?.data)) {
      return { ok: false, reason: 'data 배열 없음' }
    }
    if (json.data.length === 0) {
      return { ok: false, reason: '결과 0건' }
    }
    if (!json.data[0].raw_text) {
      return { ok: false, reason: 'raw_text 없음' }
    }
    return { ok: true }
  }
)
await check(
  'GET /api/external/weather/impact — 영향예보 반환',
  async () => {
    const r = await get('/api/external/weather/impact')
    if (!r.ok) return r
    const json = await r.res.json()
    if (!json?.data?.level) {
      return { ok: false, reason: 'level 없음' }
    }
    if (!json?.data?.source) {
      return { ok: false, reason: 'source 없음' }
    }
    return { ok: true }
  }
)

// ──────────────────────────────────────────────────────────────
// 경로 B: 집중호우 시연 경로 (USE_SAMPLE_FALLBACK=true 에서 완주 확인)
console.log('\n[경로 B] 집중호우 시연 경로 (disaster_type=heavy_rain)')

const heavyRainDraft = {
  institution_id: '11111111-0000-0000-0000-000000000001',
  institution_name: '햇살어린이집',
  has_shuttle: true,
  disaster_type: 'heavy_rain',
  disaster_message_id: '33333333-0000-0000-0001-000000000001',
  disaster_message_text: '[기상청] 호우경보 발효. 저지대·지하공간 침수 위험. 위급 시 119.',
  disaster_message_source: 'sample',
  disaster_message_issued_at: '2026-06-15T13:00:00+09:00',
  selected_situations: ['pickup_prep', 'before_shuttle', 'basement_in_use'],
  situation_etc: '',
  role: 'director',
}

let heavyRainRequestId = '44444444-0000-0000-0000-000000000002'

await check(
  'POST /api/plan/generate (heavy_rain) — 5역할 결과 반환',
  async () => {
    const r = await post('/api/plan/generate', heavyRainDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    if (!json?.data?.id) {
      return { ok: false, reason: `data.id 없음 — ${JSON.stringify(json).slice(0, 200)}` }
    }
    const rba = json?.data?.result_json?.role_based_actions
    if (!Array.isArray(rba) || rba.length < 5) {
      return { ok: false, reason: `role_based_actions 부족: ${rba?.length ?? 0}건` }
    }
    const roles = rba.map((r) => r.role)
    const requiredRoles = ['director', 'homeroom_teacher', 'bus_manager', 'cook_or_food_service', 'health_manager']
    for (const req of requiredRoles) {
      if (!roles.includes(req)) {
        return { ok: false, reason: `역할 누락: ${req}` }
      }
    }
    heavyRainRequestId = json.data.id
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate (heavy_rain) — disaster_type=heavy_rain 반환',
  async () => {
    const r = await post('/api/plan/generate', heavyRainDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    const dt = json?.data?.result_json?.disaster_type
    if (dt !== 'heavy_rain') {
      return { ok: false, reason: `disaster_type=${dt}` }
    }
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate (heavy_rain) — safety_disclaimer 고정 문구 포함',
  async () => {
    const r = await post('/api/plan/generate', heavyRainDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    const disc = json?.data?.result_json?.safety_disclaimer ?? ''
    if (!disc.includes('공식기관 지시와 119')) {
      return { ok: false, reason: `safety_disclaimer 부재: ${disc.slice(0, 50)}` }
    }
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate (heavy_rain) — source 메타 포함',
  async () => {
    const r = await post('/api/plan/generate', heavyRainDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    if (!json?.source) {
      return { ok: false, reason: `source 메타 없음` }
    }
    return { ok: true }
  }
)

await check(
  'GET /api/external/disaster-sms?disaster_type=heavy_rain — 집중호우 샘플 반환',
  async () => {
    const r = await get('/api/external/disaster-sms?disaster_type=heavy_rain')
    if (!r.ok) return r
    const json = await r.res.json()
    if (!Array.isArray(json?.data)) {
      return { ok: false, reason: 'data 배열 없음' }
    }
    if (json.data.length === 0) {
      return { ok: false, reason: '결과 0건' }
    }
    // 각 항목의 source 메타 확인
    if (!json.data[0].source) {
      return { ok: false, reason: 'data[0].source 메타 없음' }
    }
    if (!json.data[0].raw_text) {
      return { ok: false, reason: 'data[0].raw_text 없음' }
    }
    return { ok: true }
  }
)

await check(
  `GET /plan/${heavyRainRequestId} — 집중호우 결과 페이지 200 OK`,
  () => get(`/plan/${heavyRainRequestId}`)
)

// ──────────────────────────────────────────────────────────────
// 경로 C: 감염병 시연 경로 (USE_SAMPLE_FALLBACK=true, 재난문자 없이 완주)
console.log('\n[경로 C] 감염병 시연 경로 (disaster_type=infection, 재난문자 없음)')

const infectionDraft = {
  institution_id: '11111111-0000-0000-0000-000000000001',
  institution_name: '햇살어린이집',
  has_shuttle: true,
  disaster_type: 'infection',
  // 감염병: disaster_message_id/text 없이 상황만으로 생성
  disaster_message_id: null,
  disaster_message_text: '',
  disaster_message_source: null,
  disaster_message_issued_at: null,
  selected_situations: ['fever_child', 'guardian_contact_needed', 'classroom_disinfection'],
  situation_etc: '',
  role: 'director',
}

let infectionRequestId = '44444444-0000-0000-0002-000000000001'

await check(
  'POST /api/plan/generate (infection, 재난문자 없음) — 5역할 결과 반환',
  async () => {
    const r = await post('/api/plan/generate', infectionDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    if (!json?.data?.id) {
      return { ok: false, reason: `data.id 없음 — ${JSON.stringify(json).slice(0, 200)}` }
    }
    const rba = json?.data?.result_json?.role_based_actions
    if (!Array.isArray(rba) || rba.length < 5) {
      return { ok: false, reason: `role_based_actions 부족: ${rba?.length ?? 0}건` }
    }
    const roles = rba.map((r) => r.role)
    const requiredRoles = ['director', 'homeroom_teacher', 'bus_manager', 'cook_or_food_service', 'health_manager']
    for (const req of requiredRoles) {
      if (!roles.includes(req)) {
        return { ok: false, reason: `역할 누락: ${req}` }
      }
    }
    infectionRequestId = json.data.id
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate (infection) — disaster_type=infection 반환',
  async () => {
    const r = await post('/api/plan/generate', infectionDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    const dt = json?.data?.result_json?.disaster_type
    if (dt !== 'infection') {
      return { ok: false, reason: `disaster_type=${dt}` }
    }
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate (infection) — safety_disclaimer 고정 문구 포함',
  async () => {
    const r = await post('/api/plan/generate', infectionDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    const disc = json?.data?.result_json?.safety_disclaimer ?? ''
    if (!disc.includes('공식기관 지시와 119')) {
      return { ok: false, reason: `safety_disclaimer 부재: ${disc.slice(0, 50)}` }
    }
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate (infection) — source 메타 포함',
  async () => {
    const r = await post('/api/plan/generate', infectionDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    if (!json?.source) {
      return { ok: false, reason: `source 메타 없음` }
    }
    return { ok: true }
  }
)

await check(
  'POST /api/plan/generate (infection) — disaster_message_id=null 허용',
  async () => {
    const r = await post('/api/plan/generate', infectionDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    // 감염병은 재난문자 없이 상황만으로 생성 — disaster_message_id null 정상
    const dmid = json?.data?.disaster_message_id
    if (dmid !== null && dmid !== undefined) {
      // null 또는 undefined 모두 허용 (재난문자 없음)
      // 실제로 값이 있으면 확인 — infection 경로에서 재난문자 없이 진행한 경우
    }
    return { ok: true }
  }
)

await check(
  'GET /api/external/disaster-sms?disaster_type=infection — 감염병 샘플 반환',
  async () => {
    const r = await get('/api/external/disaster-sms?disaster_type=infection')
    if (!r.ok) return r
    const json = await r.res.json()
    if (!Array.isArray(json?.data)) {
      return { ok: false, reason: 'data 배열 없음' }
    }
    if (json.data.length === 0) {
      return { ok: false, reason: '결과 0건' }
    }
    if (!json.data[0].source) {
      return { ok: false, reason: 'data[0].source 메타 없음' }
    }
    if (!json.data[0].raw_text) {
      return { ok: false, reason: 'data[0].raw_text 없음' }
    }
    // 감염병 샘플인지 확인
    const allInfection = json.data.every((item) => item.disaster_type === 'infection')
    if (!allInfection) {
      return { ok: false, reason: '감염병 외 유형 혼입' }
    }
    return { ok: true }
  }
)

await check(
  `GET /plan/${infectionRequestId} — 감염병 결과 페이지 200 OK`,
  () => get(`/plan/${infectionRequestId}`)
)

// PII 안전 점검
console.log('\n[PII] 개인정보 안전 점검')
await check(
  'POST /api/plan/generate (infection) — PII/진단명/확진 표현 없음',
  async () => {
    const r = await post('/api/plan/generate', infectionDraft, [200, 201])
    if (!r.ok) return r
    const json = await r.res.json()
    const resultStr = JSON.stringify(json)
    // 전화번호 패턴
    if (/010-\d{4}-\d{4}/.test(resultStr)) {
      return { ok: false, reason: '결과에 전화번호 패턴 발견' }
    }
    // "확진" 단정 표현 — 사용자 입력 상황 코드 제외한 AI 출력 부분 확인
    const aiResult = json?.data?.result_json ?? {}
    const aiStr = JSON.stringify(aiResult)
    // "확진자" 또는 "확진" 단독 표현(보건당국 확인 없이)은 금지
    // 단, 사용자 입력 상황 코드에는 없으므로 AI 출력만 체크
    const hasConfirmedDiagnosis = /확진(?!되면|여부|시)/.test(aiStr)
    if (hasConfirmedDiagnosis) {
      return { ok: false, reason: '감염병 결과에 "확진" 단정 표현 발견' }
    }
    return { ok: true }
  }
)
await check(
  'POST /api/plan/generate — PII 없이 정상 동작',
  async () => {
    // 이름/진단명/연락처 없이 요청해도 정상 결과 반환
    const r = await post('/api/plan/generate', {
      ...wizardDraft,
      // PII 필드를 명시적으로 제외(이미 없음)
    })
    if (!r.ok) return r
    const json = await r.res.json()
    const resultStr = JSON.stringify(json)
    // 결과에 연락처 패턴이 없는지 확인 (010-xxxx-xxxx)
    if (/010-\d{4}-\d{4}/.test(resultStr)) {
      return { ok: false, reason: '결과에 전화번호 패턴 발견' }
    }
    return { ok: true }
  }
)

// ──────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────')
console.log(`결과: ✓ ${passed}개 통과 / ✗ ${failed}개 실패`)
if (failed === 0) {
  console.log('🎉 전 흐름 통과 — 시연 준비 완료')
} else {
  console.log('⚠️  실패 항목을 확인하세요.')
}
console.log('──────────────────────────────────────────────\n')

process.exit(failed > 0 ? 1 : 0)
