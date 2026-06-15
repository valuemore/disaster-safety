/**
 * 프로덕션 스모크 테스트
 * 실행: node scripts/smoke-test-prod.mjs [BASE_URL]
 */
const BASE = process.argv[2] ?? 'https://disastersafety.vercel.app'
let passed = 0, failed = 0

async function check(label, fn) {
  try {
    const result = await fn()
    if (result.ok) { console.log('  ✓', label); passed++ }
    else { console.error('  ✗', label, '--', result.reason); failed++ }
  } catch (err) { console.error('  ✗', label, '--', err.message); failed++ }
}

async function get(path, expectStatus = 200) {
  const res = await fetch(BASE + path)
  const expected = Array.isArray(expectStatus) ? expectStatus : [expectStatus]
  if (!expected.includes(res.status)) return { ok: false, reason: `HTTP ${res.status} (expected ${expected.join('|')})` }
  return { ok: true, res }
}

async function post(path, body, expectStatus = 200) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const expected = Array.isArray(expectStatus) ? expectStatus : [expectStatus]
  if (!expected.includes(res.status)) {
    const text = await res.text().catch(() => '')
    return { ok: false, reason: `HTTP ${res.status} -- ${text.slice(0, 150)}` }
  }
  return { ok: true, res }
}

async function patch(path, body) {
  const res = await fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
  return { ok: true, res }
}

const SAMPLE_ID = '44444444-4444-4444-4444-444444444444'
const wizardDraft = {
  institution_id: '11111111-1111-1111-1111-111111111111',
  institution_name: '햇살어린이집',
  has_shuttle: true,
  disaster_message_id: null,
  disaster_message_text: '[기상청] 폭염경보 발효. 야외활동 자제, 충분한 수분 섭취.',
  disaster_message_source: 'manual',
  disaster_message_issued_at: null,
  selected_situations: ['outdoor_play', 'heat_symptom_suspected'],
  situation_etc: '',
  role: 'director',
}

console.log('\n🌐 재난안전MVP 프로덕션 스모크 테스트')
console.log('   URL:', BASE, '\n')

// S0
console.log('[S0] 랜딩')
await check('GET / — 200 OK', () => get('/'))

// S1/S2
console.log('\n[S1/S2] 기관 관련')
await check('GET /institutions — 200', () => get('/institutions'))
await check('GET /institutions/new — 200', () => get('/institutions/new'))
await check('GET /api/institutions — DB 또는 샘플 반환', async () => {
  const r = await get('/api/institutions')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!Array.isArray(json?.data)) return { ok: false, reason: 'data 배열 없음' }
  console.log(`    → 기관 수: ${json.data.length} (${json.source !== 'sample' ? '실DB' : '샘플'})`)
  return { ok: true }
})

// S3/S4
console.log('\n[S3/S4] 재난문자 · 상황')
await check('GET /plan/new — 200', () => get('/plan/new'))
await check('GET /plan/new/message — 200', () => get('/plan/new/message'))
await check('GET /plan/new/situation — 200', () => get('/plan/new/situation'))

// S5: AI 생성
console.log('\n[S5] AI 대응계획 생성')
let generatedId = SAMPLE_ID
await check('POST /api/plan/generate — 대응계획 생성', async () => {
  const r = await post('/api/plan/generate', wizardDraft, [200, 201])
  if (!r.ok) return r
  const json = await r.res.json()
  if (!json?.data?.id) return { ok: false, reason: `data.id 없음: ${JSON.stringify(json).slice(0, 200)}` }
  if (!json?.data?.result_json?.director_checklist?.length) return { ok: false, reason: 'director_checklist 없음' }
  generatedId = json.data.id
  const src = json.source === 'db' ? '실DB 저장' : '샘플 fallback'
  const aiTag = json.data.is_fallback ? '(AI샘플)' : '(실AI)'
  console.log(`    → ID: ${generatedId.slice(0, 8)}... ${src} ${aiTag}`)
  return { ok: true }
})
await check('POST /api/plan/generate — priority 유효값', async () => {
  const r = await post('/api/plan/generate', wizardDraft)
  if (!r.ok) return r
  const json = await r.res.json()
  const p = json?.data?.result_json?.priority
  if (!['high', 'medium', 'low'].includes(p)) return { ok: false, reason: `priority=${p}` }
  return { ok: true }
})
await check('POST /api/plan/generate — safety_disclaimer 고정 문구', async () => {
  const r = await post('/api/plan/generate', wizardDraft)
  if (!r.ok) return r
  const json = await r.res.json()
  const d = json?.data?.result_json?.safety_disclaimer ?? ''
  if (!d.includes('공식기관 지시와 119')) return { ok: false, reason: `문구 없음: ${d.slice(0, 80)}` }
  return { ok: true }
})
await check('POST /api/plan/generate — 빈 입력 400', () =>
  post('/api/plan/generate', { ...wizardDraft, disaster_message_text: '', selected_situations: [] }, 400)
)

// 결과 페이지
console.log('\n[S5] 결과 페이지')
await check(`GET /plan/${SAMPLE_ID} — 200`, () => get(`/plan/${SAMPLE_ID}`))
await check(`GET /plan/${generatedId.slice(0,8)}... — 200`, () => get(`/plan/${generatedId}`))

// S6
console.log('\n[S6] 체크리스트 토글')
await check('PATCH /api/plan/[id]/checklist — 200', () =>
  patch(`/api/plan/${SAMPLE_ID}/checklist/${SAMPLE_ID}-director-0`, { is_done: true })
)

// S7
console.log('\n[S7] 사후기록')
await check(`GET /plan/${generatedId.slice(0,8)}../after-action — 200`, () => get(`/plan/${generatedId}/after-action`))
await check('GET /api/plan/[id]/after-action — 200', async () => {
  const r = await get(`/api/plan/${generatedId}/after-action`)
  if (!r.ok) return r
  const json = await r.res.json()
  if (!('data' in json)) return { ok: false, reason: 'data 키 없음' }
  return { ok: true }
})
await check('POST /api/plan/[id]/after-action — 저장 200', () =>
  post(`/api/plan/${generatedId}/after-action`, {
    message_checked_at: new Date().toISOString(),
    outdoor_adjusted: true, cooling_checked: true, child_health_issue: false,
    parents_notified: true, shuttle_checked: null, completed_by: '원장',
    notes: '온도계 수동 확인', improvement: '온도계 비치 검토',
  })
)

// S8/S9
console.log('\n[S8/S9] 관리자 대시보드')
await check('GET /admin — 200', () => get('/admin'))
await check('GET /api/admin/stats — stats 반환', async () => {
  const r = await get('/api/admin/stats')
  if (!r.ok) return r
  const json = await r.res.json()
  if (typeof json?.data?.institution_count !== 'number') return { ok: false, reason: 'institution_count 없음' }
  console.log(`    → 기관: ${json.data.institution_count} / 오늘계획: ${json.data.today_plan_count} / 고위험: ${json.data.high_priority_count}`)
  return { ok: true }
})
await check('GET /api/admin/plans — 목록 반환', async () => {
  const r = await get('/api/admin/plans')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!Array.isArray(json?.data)) return { ok: false, reason: 'data 배열 없음' }
  console.log(`    → 계획 수: ${json.data.length}`)
  return { ok: true }
})
await check('GET /admin/institutions/[id] — 200', () =>
  get('/admin/institutions/11111111-0000-0000-0000-000000000001')
)

// P6
console.log('\n[P6] 공공 API fallback')
await check('GET /api/external/geocode — 좌표 반환', async () => {
  const r = await get('/api/external/geocode?query=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C%20%EC%A2%85%EB%A1%9C%EA%B5%AC')
  if (!r.ok) return r
  const json = await r.res.json()
  if (typeof json?.data?.lat !== 'number') return { ok: false, reason: 'lat 없음' }
  console.log(`    → source: ${json.source} / lat: ${json.data.lat} / lng: ${json.data.lng}`)
  return { ok: true }
})
await check('GET /api/external/weather — 날씨 반환', async () => {
  const r = await get('/api/external/weather?lat=37.56&lng=126.97')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!json?.data?.source) return { ok: false, reason: 'source 없음' }
  console.log(`    → source: ${json.data.source} / temp: ${json.data.temp} / feels_like: ${json.data.feels_like} / humidity: ${json.data.humidity}`)
  return { ok: true }
})
await check('GET /api/external/disaster-sms — 재난문자 반환', async () => {
  const r = await get('/api/external/disaster-sms')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!Array.isArray(json?.data) || json.data.length === 0) return { ok: false, reason: '결과 없음' }
  console.log(`    → source: ${json.data[0].source} / 건수: ${json.data.length}`)
  return { ok: true }
})
await check('GET /api/external/weather/impact — 영향예보 반환', async () => {
  const r = await get('/api/external/weather/impact')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!json?.data?.level) return { ok: false, reason: 'level 없음' }
  console.log(`    → source: ${json.data.source} / level: ${json.data.level} (${json.data.label})`)
  return { ok: true }
})

// 결과
console.log('\n──────────────────────────────────────')
console.log(`결과: ✓ ${passed}개 통과 / ✗ ${failed}개 실패`)
if (failed === 0) console.log('🎉 프로덕션 전 흐름 통과 — 배포 정상')
else console.log('⚠️  실패 항목 확인 필요')
console.log('──────────────────────────────────────\n')

process.exit(failed > 0 ? 1 : 0)
