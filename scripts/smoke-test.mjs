/**
 * 스모크 테스트 (Node.js ESM) — 리팩토링 흐름 기준
 * 실행: USE_SAMPLE_FALLBACK=true 로 dev/start 후 `node scripts/smoke-test.mjs`
 * 서버가 http://localhost:3000 에서 실행 중이어야 한다.
 *
 * 새 흐름: 로그인 → 재난문자(자동분류) → 상황 → 결과(읽기) → 공유/발송
 *  - 체크리스트 토글 / 사후기록 / 화면 샘플선택 테스트 제거
 *  - 로그인 세션 쿠키 + 보호경로 가드 + 공유/발송/연락처/관리자 페이지네이션 추가
 */

const BASE = 'http://localhost:3000'

let passed = 0
let failed = 0
let cookie = '' // 로그인 세션 쿠키 저장

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

async function get(path, { expect = 200, auth = false, manual = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: auth && cookie ? { cookie } : {},
    redirect: manual ? 'manual' : 'follow',
  })
  const expected = Array.isArray(expect) ? expect : [expect]
  if (!expected.includes(res.status)) {
    return { ok: false, reason: `HTTP ${res.status} (expected ${expected.join('|')})` }
  }
  return { ok: true, res }
}

async function post(path, body, { expect = 200, auth = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth && cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
  const expected = Array.isArray(expect) ? expect : [expect]
  if (!expected.includes(res.status)) {
    const text = await res.text().catch(() => '')
    return { ok: false, reason: `HTTP ${res.status} (expected ${expected.join('|')}) — ${text.slice(0, 100)}` }
  }
  return { ok: true, res }
}

console.log('\n🔥 재난안전MVP 스모크 테스트 (리팩토링 흐름)\n')

// ── 공개 페이지 ─────────────────────────────────────────────
console.log('[공개] 랜딩·로그인·등록')
await check('GET / — 200', () => get('/'))
await check('GET /login — 200', () => get('/login'))
await check('GET /register — 200', () => get('/register'))

// ── 인증 ────────────────────────────────────────────────────
console.log('\n[인증] 로그인 세션')
await check('POST /api/auth/login — 세션 발급', async () => {
  const r = await post('/api/auth/login', { login_id: 'demo', pin: '1234' })
  if (!r.ok) return r
  const setCookie = r.res.headers.get('set-cookie')
  if (!setCookie || !setCookie.includes('ds_session')) return { ok: false, reason: 'ds_session 쿠키 없음' }
  cookie = setCookie.split(';')[0]
  const json = await r.res.json()
  if (!json?.data?.id) return { ok: false, reason: 'data.id 없음' }
  return { ok: true }
})
await check('GET /api/auth/session — 로그인 상태 확인', async () => {
  const r = await get('/api/auth/session', { auth: true })
  if (!r.ok) return r
  const json = await r.res.json()
  if (!json?.data?.id) return { ok: false, reason: 'session data 없음' }
  return { ok: true }
})
await check('GET /plan/new/message (미인증) — /login 가드(307)', () =>
  get('/plan/new/message', { expect: 307, manual: true })
)
await check('GET /plan/new/message (인증) — 200', () => get('/plan/new/message', { auth: true }))
await check('GET /plan/new/situation (인증) — 200', () => get('/plan/new/situation', { auth: true }))
await check('GET /account/contacts (인증) — 200', () => get('/account/contacts', { auth: true }))

// ── 어린이집포털 검색 ───────────────────────────────────────
console.log('\n[등록] 어린이집포털 API')
await check('GET /api/external/childcare?q=햇살 — 후보 반환', async () => {
  const r = await get('/api/external/childcare?q=%ED%96%87%EC%82%B4')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!Array.isArray(json?.data) || json.data.length === 0) return { ok: false, reason: '후보 없음' }
  if (typeof json.data[0].infant_total_count !== 'number') return { ok: false, reason: '파생값 없음' }
  return { ok: true }
})

// ── 재난유형 자동분류 ───────────────────────────────────────
console.log('\n[분류] 재난유형 자동분류')
await check('POST /api/plan/classify (폭염문구) — heatwave', async () => {
  const r = await post('/api/plan/classify', { raw_text: '[기상청] 폭염경보 발효. 야외활동 자제.' })
  if (!r.ok) return r
  const json = await r.res.json()
  if (json?.data?.disaster_type !== 'heatwave') return { ok: false, reason: `type=${json?.data?.disaster_type}` }
  return { ok: true }
})
await check('POST /api/plan/classify (호우문구) — heavy_rain', async () => {
  const r = await post('/api/plan/classify', { raw_text: '[기상청] 호우경보. 저지대 침수 위험.' })
  if (!r.ok) return r
  const json = await r.res.json()
  if (json?.data?.disaster_type !== 'heavy_rain') return { ok: false, reason: `type=${json?.data?.disaster_type}` }
  return { ok: true }
})

// ── 대응계획 생성 (3유형) ───────────────────────────────────
console.log('\n[생성] 대응계획 (5역할 read-only)')
const baseDraft = {
  has_shuttle: true,
  disaster_message_text: '[기상청] 폭염경보 발효. 야외활동 자제, 충분한 수분 섭취.',
  disaster_message_source: 'manual',
  disaster_message_issued_at: '2026-06-15T10:00:00+09:00',
  selected_situations: ['before_outdoor', 'heat_symptom_suspected'],
  situation_etc: '',
}
const drafts = {
  heatwave: { ...baseDraft, disaster_type: 'heatwave' },
  heavy_rain: {
    ...baseDraft, disaster_type: 'heavy_rain',
    disaster_message_text: '[기상청] 호우경보 발효. 저지대·지하 침수 위험.',
    selected_situations: ['pickup_prep', 'basement_in_use'],
  },
  infection: {
    ...baseDraft, disaster_type: 'infection',
    disaster_message_text: '',
    selected_situations: ['fever_child', 'guardian_contact_needed'],
  },
}
let generatedId = ''
for (const [type, draft] of Object.entries(drafts)) {
  await check(`POST /api/plan/generate (${type}) — 5역할 + 고정 disclaimer`, async () => {
    const r = await post('/api/plan/generate', draft, { expect: [200, 201], auth: true })
    if (!r.ok) return r
    const json = await r.res.json()
    if (!json?.data?.id) return { ok: false, reason: 'data.id 없음' }
    const rba = json?.data?.result_json?.role_based_actions
    if (!Array.isArray(rba) || rba.length < 5) return { ok: false, reason: `role_based_actions 부족: ${rba?.length ?? 0}` }
    const disc = json?.data?.result_json?.safety_disclaimer ?? ''
    if (!disc.includes('공식기관 지시와 119')) return { ok: false, reason: 'disclaimer 부재' }
    if (type === 'heatwave') generatedId = json.data.id
    return { ok: true }
  })
}
await check('POST /api/plan/generate — 상황 없으면 400', () =>
  post('/api/plan/generate', { ...drafts.heatwave, selected_situations: [] }, { expect: 400, auth: true })
)
await check(`GET /plan/[id] — 결과 페이지 200`, () => get(`/plan/${generatedId}`, { auth: true }))

// ── 공유 / 발송 ─────────────────────────────────────────────
console.log('\n[공유] 링크·발송')
let shareToken = ''
await check('POST /api/plan/[id]/share — 토큰 발급', async () => {
  const r = await post(`/api/plan/${generatedId}/share`, {}, { auth: true })
  if (!r.ok) return r
  const json = await r.res.json()
  if (!json?.data?.token) return { ok: false, reason: 'token 없음' }
  shareToken = json.data.token
  return { ok: true }
})
await check('GET /share/[token]/director — 공개 페이지 200', () => get(`/share/${shareToken}/director`))
await check('GET /share/[token]/parent — 학부모 안내문 200', () => get(`/share/${shareToken}/parent`))
await check('POST /api/plan/[id]/notify — 발송(시뮬레이션)', async () => {
  const r = await post(`/api/plan/${generatedId}/notify`, {}, { auth: true })
  if (!r.ok) return r
  const json = await r.res.json()
  if (typeof json?.data?.sent !== 'number') return { ok: false, reason: 'sent 없음' }
  return { ok: true }
})

// ── 담당자 연락처 ───────────────────────────────────────────
console.log('\n[연락처] 역할별 담당자')
await check('GET /api/account/contacts — 조회', async () => {
  const r = await get('/api/account/contacts', { auth: true })
  if (!r.ok) return r
  const json = await r.res.json()
  if (!Array.isArray(json?.data)) return { ok: false, reason: 'data 배열 아님' }
  return { ok: true }
})
await check('PUT /api/account/contacts — 저장', async () => {
  const r = await fetch(`${BASE}/api/account/contacts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      contacts: [
        { role: 'director', name: '원장', phone: '010-1234-5678', consent_sms: true, consent_kakao: false, consent_share_link: true, is_active: true },
      ],
    }),
  })
  if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` }
  return { ok: true }
})

// ── 관리자 ──────────────────────────────────────────────────
console.log('\n[관리자] 대시보드')
await check('GET /admin — 200', () => get('/admin'))
await check('GET /api/admin/institutions?page=1 — 페이지네이션', async () => {
  const r = await get('/api/admin/institutions?page=1&size=20')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!Array.isArray(json?.data) || typeof json?.total !== 'number') return { ok: false, reason: 'data/total 없음' }
  return { ok: true }
})
await check('GET /api/admin/stats — 통계', async () => {
  const r = await get('/api/admin/stats')
  if (!r.ok) return r
  const json = await r.res.json()
  if (typeof json?.data?.institution_count !== 'number') return { ok: false, reason: 'institution_count 없음' }
  return { ok: true }
})
await check('GET /api/admin/plans — 목록', async () => {
  const r = await get('/api/admin/plans')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!Array.isArray(json?.data)) return { ok: false, reason: 'data 배열 아님' }
  return { ok: true }
})

// ── 공공 API fallback ───────────────────────────────────────
console.log('\n[공공API] fallback')
await check('GET /api/external/disaster-sms — 목록', async () => {
  const r = await get('/api/external/disaster-sms')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!Array.isArray(json?.data) || json.data.length === 0) return { ok: false, reason: '결과 없음' }
  return { ok: true }
})
await check('GET /api/external/weather?lat&lng — 날씨', async () => {
  const r = await get('/api/external/weather?lat=37.56&lng=126.97')
  if (!r.ok) return r
  const json = await r.res.json()
  if (!json?.data?.source) return { ok: false, reason: 'source 없음' }
  return { ok: true }
})

// ── PII 안전 ────────────────────────────────────────────────
console.log('\n[PII] 안전 점검')
await check('생성 결과에 전화번호 패턴 없음', async () => {
  const r = await post('/api/plan/generate', drafts.infection, { expect: [200, 201], auth: true })
  if (!r.ok) return r
  const json = await r.res.json()
  if (/010-\d{4}-\d{4}/.test(JSON.stringify(json?.data?.result_json ?? {}))) {
    return { ok: false, reason: '전화번호 패턴 발견' }
  }
  return { ok: true }
})

console.log('\n──────────────────────────────────────────────')
console.log(`결과: ✓ ${passed}개 통과 / ✗ ${failed}개 실패`)
console.log(failed === 0 ? '🎉 전 흐름 통과 — 시연 준비 완료' : '⚠️  실패 항목을 확인하세요.')
console.log('──────────────────────────────────────────────\n')
process.exit(failed > 0 ? 1 : 0)
