# 07_CONTEXT_LEDGER — 컨텍스트 원장(세션 연속성)

> 세션이 길어져도 개발 맥락을 잃지 않기 위한 **단일 요약 문서**.
> **운영 규칙**: 큰 작업/슬라이스를 마칠 때마다, 그리고 세션 종료 시 이 문서를 갱신한다. "다음 세션 시작 프롬프트"는 항상 최신화한다.
>
> 최종 업데이트: **2026-06-16** / 업데이트 주체: 전면 리팩토링(R-series) — build 32라우트, smoke-test 30/30 PASS (샘플모드)

---

## 전면 리팩토링 (2026-06-16, R-series) — 실서비스형 흐름 전환
계획 파일: `~/.claude/plans/vivid-orbiting-leaf.md`. 새 흐름: **로그인 → 재난문자(자동분류) → 상황 → 역할별 대응계획(읽기) → 공유/발송**.

- **S-A 인증**: 간편 기관 로그인(등록번호+PIN, HMAC 서명 쿠키 `ds_session`). `lib/auth/{session,pin}.ts`, `app/api/auth/{login,logout,session}`, `app/login`, 루트 `proxy.ts`(Next16 미들웨어, `/plan`·`/account`·`/institutions` 가드). `RoleProvider`→`SessionProvider` 교체, 홈/AppHeader 개편.
- **S-B 마법사 축소 + 화면 샘플 제거**: `/plan/new/type`·`/plan/new`(기관선택) 삭제. MessageInput 샘플탭 제거(실시간조회/원문만). WizardProgress 2단계. WizardDraft에서 `'sample'` source·`role` 제거, `disaster_type` nullable.
- **S-C 재난유형 자동분류**: `classifyFromText`(키워드) + `lib/ai/classifyDisaster.ts`(AI보조) + `app/api/plan/classify`. generate route: institution_id를 **세션값으로 override**, 재난문자 `disaster_messages` INSERT, created_by_role='director'.
- **S-D 결과 읽기화**: ChecklistCard/AfterActionForm/after-action·checklist API **삭제**(테이블은 보존). PlanResult 읽기전용. aiPlanSchema `after_action_draft` optional, 프롬프트에서 제거.
- **S-E 어린이집포털 API**: `lib/external/childcareInfo.ts`(대소문자 정규화·파생값 infant/preschool/special·역할자동활성화 근거) + `app/api/external/childcare`. `app/register` 검색→자동채움→로그인정보→등록(자동로그인). `api_raw` 원본 보존.
- **S-F 역할별 연락처**: `institution_staff_contacts`(0004, anon SELECT 없음) + `StaffContactsForm` + `/account/contacts` + `/api/account/contacts`(GET/PUT 세션 본인). consent_sms/kakao/share_link/is_active.
- **S-G 공유**: `action_requests.share_token`(0004) + `/api/plan/[id]/share`(소유검증) + 공개 `/share/[token]/[role]` + `SharePanel`(링크복사/인쇄) + globals.css `@media print`.
- **S-H 발송**: `lib/external/notify.ts`(알림톡→SMS→sample fallback, consent 게이트) + `/api/plan/[id]/notify` + `notify_logs`(0004). 발송 본문에 유아 PII 미포함.
- **S-I 관리자 1,000+**: `/api/admin/institutions`(페이지네이션·검색·count) + `InstitutionTable`(검색/페이지) 로 전체로드 폐지. 활성기관(30일) 지표 추가.
- **마이그레이션**: `supabase/migrations/0004_auth_and_sharing.sql`(멱등, 미적용 — 원격 DB 적용은 사용자 확인 후). 체크리스트/사후기록 테이블은 DROP 안 함.

### S-E2 완료 (2026-06-16)
- 등록 직후 `/institutions/[id]/profile?onboarding=1`로 이동 → 재난안전 추가정보(기존 institution_risk_profiles) 입력 + "다음: 담당자 연락처" 온보딩 동선.
- 생성 단계에 **당일 재원·등원 유아수/출근 교직원수**(선택) 입력 → `buildAiInput` institution 화이트리스트(`today_present_*`)로 AI 전달.
- 참고: 요청 세부 필드(cooling_room_count, is_lowland_area 등)는 기존 `disaster_specific` 키(cooling_ok, low_ground 등)로 이미 수집 — 개명 없이 매핑 유지.

### 남은 작업 (refinement)
- `docs/00·02·03·04·05` 본문 갱신(새 흐름 반영)은 후속. (CLAUDE.md·07·08은 반영 완료)
- 0004 마이그레이션 원격 적용 + 실 API(childcare/SMS/알림톡) 키 연동 검증.

### 다음 세션 시작 프롬프트
> "재난안전 리팩토링 후속: (1) docs/00·02·03·04·05 본문을 새 흐름(로그인→자동분류→읽기계획→공유)으로 갱신, (2) 0004 마이그레이션 원격 적용 후 실연동(childcare/SMS/알림톡) 키 검증, (3) 'other' 재난유형 UX 확정. 계획: ~/.claude/plans/vivid-orbiting-leaf.md, 현황: docs/07_CONTEXT_LEDGER.md R-series."

---

## 현재 MVP 목표
지자체 재난문자 → 유아교육기관 역할별 대응계획(읽기) + 공유. 실서비스형 흐름(로그인 시작). 공모전 제출용 작동형 시제품.

## 완료된 기능
- 기획 문서 7종(`docs/00~06`) 작성.
- 프로젝트 운영체계(CLAUDE.md, docs/07~10, skills 5, agents 6) 세팅.
- **P0 스캐폴딩 완료**: Next.js 16.2.9 + React 19 + Tailwind v4 + shadcn 4.x + lucide-react.
  - T-001~T-004: 스캐폴딩, Supabase 유틸, env/fallback 인프라, 공통 컴포넌트, 역할선택 랜딩.
- **P1 기관/프로필 완료**: 빌드 7개 라우트 정상.
  - T-010: `supabase/migrations/0001_initial.sql` — 6개 테이블, CHECK, 인덱스, RLS, 트리거.
  - T-011: `supabase/seed.sql` + `lib/sample/` TS 픽스처(institutions/profiles/messages/action_results). `lib/types/db.ts` 타입 정의.
  - T-012: `RoleProvider` (localStorage) + `useRole` 훅 + AppHeader 역할 배지. `app/page.tsx` 역할 선택 시 setRole() + 라우팅.
  - T-013: `components/institutions/InstitutionForm.tsx` + `app/institutions/new/page.tsx` + `GET|POST /api/institutions`. 기관 목록 `app/institutions/page.tsx` 포함.
  - T-014: `components/institutions/ProfileForm.tsx` (스텝퍼·토글, PII 없음) + `app/institutions/[id]/profile/page.tsx` + `GET|POST /api/institutions/[id]/profile`.
- **P2 재난문자/상황 완료**: 빌드 13개 라우트 정상.
  - T-020: `lib/hooks/useWizardState.ts` (sessionStorage 기반 wizard draft), `components/wizard/WizardProgress.tsx` (스텝 인디케이터), `app/plan/new/page.tsx` (기관 선택 진입점, Suspense 경계 포함).
  - T-021: `components/plan/MessageInput.tsx` (샘플 선택/원문 탭) + `app/plan/new/message/page.tsx`.
  - T-022: `components/plan/SituationPicker.tsx` (토글 최대 3개, 기타 입력) + `app/plan/new/situation/page.tsx`.
  - 추가: `app/api/plan/generate/route.ts` (샘플 결과 stub → P3에서 교체), `app/plan/[requestId]/page.tsx`, `app/plan/[requestId]/after-action/page.tsx`.
- **P3 AI 생성 완료**: 빌드 14개 라우트 정상.
  - T-030: `lib/types/wizard.ts` (WizardDraft 분리), `lib/ai/buildAiInput.ts` (화이트리스트 직렬화, PII 0건).
  - T-031: `lib/ai/aiPlanSchema.ts` (zod 스키마 + SAFETY_DISCLAIMER_FIXED).
  - T-032/033/034: `lib/ai/callClaude.ts` (claude-haiku-4-5, 타임아웃 12s, 1회 재시도, 샘플 fallback, prefill JSON-only). `app/api/plan/generate/route.ts` 실구현(DB 저장 + checklist_items INSERT).
  - T-035: `components/plan/PlanResult.tsx` (역할 탭 4개), `app/plan/[requestId]/page.tsx` (서버 데이터 로드 + PlanResult 렌더).
  - T-036: `components/plan/ChecklistCard.tsx` (낙관적 토글 + PATCH API), `app/api/plan/[requestId]/checklist/[itemId]/route.ts`. `components/plan/ParentNoticeCard.tsx` (복사 버튼).
- **P4 결과 활용 완료**: 빌드 15개 라우트 정상.
  - T-040/041: ChecklistCard 낙관적 토글·진행률, ParentNoticeCard 복사 버튼 — P3에서 이미 완성.
  - T-042: `app/api/plan/[requestId]/after-action/route.ts` (GET/POST, upsert, 샘플 모드), `components/plan/AfterActionForm.tsx` (AI 초안 자동 채움, ToggleField, PII 경고, 저장 성공 화면), `app/plan/[requestId]/after-action/page.tsx` (서버 컴포넌트, 기관 has_shuttle 포함).
- **P5 관리자 대시보드 완료**: 빌드 19개 라우트 정상.
  - T-050: `lib/sample/admin.ts` (샘플 stats·plans), `app/api/admin/stats/route.ts` (집계), `app/api/admin/plans/route.ts` (목록·기관 필터), `components/admin/StatsCards.tsx`, `components/admin/RecentPlanList.tsx`, `components/admin/InstitutionCard.tsx`, `app/admin/page.tsx` (force-dynamic, 통계+계획목록+기관목록).
  - T-051: `app/admin/institutions/[id]/page.tsx` (기관 상세 + 계획 이력), `app/api/admin/plans?institution_id` 기관 필터 지원.
- **P6 공공 API 연동 완료**: 빌드 23개 라우트 정상.
  - T-060: `lib/external/geocode.ts` (Kakao Local API, 샘플 fallback) + `app/api/external/geocode/route.ts` + InstitutionForm 자동채움 버튼.
  - T-061: `lib/external/weather.ts` (KMA 초단기예보, Lambert 좌표변환, feels_like 계산, 샘플 fallback) + `app/api/external/weather/route.ts` + `buildAiInput` WeatherContext 주입.
  - T-062: `lib/external/impactForecast.ts` (기상청 폭염영향예보, 샘플 fallback) + `lib/external/disasterSms.ts` (행안부 긴급재난문자, 샘플 fallback) + `app/api/external/disaster-sms/route.ts` + `app/api/external/weather/impact/route.ts` + MessageInput '실시간 조회' 탭 추가.
  - wizard.ts에 `disaster_message_source: 'api'` 추가.
  - 스모크 테스트 S0→P6 **30/30 통과** (2026-06-15).
- typecheck + build 통과(23개 라우트).

## 완료된 기능 (P7 추가)
- **P7 시연 폴리시·배포 준비 완료** (2026-06-15):
  - T-070: 스모크 테스트 30/30 통과 (USE_SAMPLE_FALLBACK=true 오프라인 모드).
  - T-071: AppHeader 모바일 개선(xs 화면 nav 축약, 역할배지 sm+, "기관 관리" 모바일 숨김). `/plan/[requestId]/loading.tsx` 생성(대응계획 생성 대기 스켈레톤).
  - T-072: `docs/09_DEMO_SCRIPT.md` 배포 URL·P6 시연 포인트·체크리스트 갱신.
  - T-073: `vercel.json` 생성(AI route 30s, 외부 API 15s maxDuration). Vercel CLI 설치 완료. GitHub 원격 저장소 연결 + `vercel` 실행은 사용자 로그인 필요.

## 완료된 기능 (P8-T8-2 추가)
- **P8-T8-2: 재난유형 확장 DB 마이그레이션 + 타입 동기화** (2026-06-15):
  - `supabase/migrations/0002_disaster_expansion.sql` 신규 작성 (멱등, PostgreSQL 15+).
    - (a) disaster_messages.disaster_type CHECK 제약 (heatwave/heavy_rain/infection).
    - (b) institution_risk_profiles 신규 테이블 (공통컬럼+disaster_specific JSONB, 트리거, RLS).
    - (c) institutions.staff_profile JSONB 컬럼 추가.
    - (d) checklist_items.role CHECK 5종으로 확장 (cook_or_food_service, health_manager 추가).
    - (e) action_requests.risk_profile_id 신규 컬럼 (heatwave_profile_id 유지·deprecated).
    - (f) after_action_records.disaster_type, checked_items 컬럼 추가.
    - (g) heatwave_profiles → institution_risk_profiles 데이터 이관 (멱등, UUID 동일 유지).
  - `lib/types/db.ts`: DisasterType 타입, InstitutionRiskProfile 인터페이스, ChecklistRole 5종, ActionRequest.risk_profile_id, Institution.staff_profile, AfterActionRecord.disaster_type/checked_items 추가.
  - `components/plan/ChecklistCard.tsx`: ROLE_LABELS에 cook_or_food_service/health_manager 추가.
  - `lib/disaster/types.ts`: DB_ROLE_TO_ROLEKEY 5종 완성.
  - `lib/sample/action_results.ts`: SAMPLE_ACTION_REQUEST.risk_profile_id 추가.
  - typecheck(`npx tsc --noEmit`) + build(`npm run build`) 23개 라우트 정상 통과.
  - **원격 DB 적용 완료** (2026-06-15, Supabase Management API `/v1/projects/{ref}/database/query`) — service_role은 DDL 불가하여 personal access token 경로 사용. 이관 검증: heatwave_profiles 3건 = institution_risk_profiles(heatwave) 3건. risk_profile_id/staff_profile/checked_items 컬럼 + checklist_items role CHECK 5종 확인.

## 완료된 기능 (P8-T8-3 추가)
- **P8-T8-3: AI 스키마 role_based_actions 전환 + legacyAdapter + system prompt 분리** (2026-06-15):
  - `lib/ai/aiPlanSchema.ts` — role_based_actions 배열(5종 RoleKey), disaster_type, after_action_draft.checked_items 추가. 레거시 *_checklist optional 유지.
  - `lib/ai/legacyAdapter.ts` (신규) — getActionsByRole / ensureLegacyChecklists: role_based_actions → 레거시 필드 파생.
  - `lib/ai/systemPrompt.ts` (신규) — 재난유형 무관 공통 안전규칙 7개.
  - `lib/ai/disaster/heatwave.ts` (신규) — 폭염 policy block + output guidance(역할별 가이드).
  - `lib/ai/buildSystemPrompt.ts` (신규) — 공통+유형별 조립, OUTPUT_SCHEMA_HINT(role_based_actions 구조). P9/P10 placeholder 포함.
  - `lib/ai/callClaude.ts` — buildSystemPrompt(input.disaster_type) 사용, ensureLegacyChecklists 적용.
  - `lib/sample/action_results.ts` — SAMPLE_AI_RESULT에 role_based_actions(5역할), disaster_type:'heatwave', after_action_draft.checked_items 추가.
  - `lib/types/db.ts` — AiPlanResult에 RoleBasedAction 인터페이스, role_based_actions?, disaster_type? 추가. 레거시 *_checklist optional 전환.
  - `app/api/plan/generate/route.ts` — checklist INSERT를 role_based_actions 기반으로 전환(레거시 fallback 유지). cook/health는 DB CHECK 확인 후 저장(주석).
  - `app/plan/[requestId]/page.tsx` — buildChecklistFromResult에 ensureLegacyChecklists 적용.
  - `components/plan/AfterActionForm.tsx` — AiDraft 레거시 필드 optional화, inferBool/ToggleField.hint undefined 허용.
  - typecheck(`npx tsc --noEmit`) + build(`npm run build`) **23개 라우트 정상 통과**.
  - 폭염 시연 흐름 무중단 — 레거시 필드 ensureLegacyChecklists로 항상 보장.

## 완료된 기능 (P8-T8-5 추가)
- **P8-T8-5: 재난유형 선택 화면 신규 추가** (2026-06-15):
  - `app/plan/new/type/page.tsx` (신규) — DISASTER_REGISTRY 순회 카드 UI. 폭염(enabled) 선택 시 WizardDraft.disaster_type 저장 후 `/plan/new/message` 이동. heavy_rain/infection은 "준비중" 뱃지 + opacity-40 비활성. 딥링크 진입 시 institution_id 없으면 `/plan/new` 리다이렉트(가드). disaster_type 기본값 'heatwave' 항상 보장.
  - `components/wizard/WizardProgress.tsx` — STEPS 3개→4개 (재난유형 선택 Step 1 추가). currentStep 타입 `1|2|3` → `1|2|3|4`.
  - `app/plan/new/page.tsx` — "다음" 라우팅 `/plan/new/message` → `/plan/new/type`.
  - `app/plan/new/message/page.tsx` — WizardProgress currentStep 1→2.
  - `app/plan/new/situation/page.tsx` — WizardProgress currentStep 2→3.
  - 마법사 흐름: `/plan/new`(기관) → `/plan/new/type`(재난유형, 신규) → `/plan/new/message`(재난문자) → `/plan/new/situation`(현재상황) → `/plan/[id]`(결과).
  - typecheck(`npx tsc --noEmit`) + build(`npm run build`) **24개 라우트 정상 통과**.
  - 폭염 시연 흐름 무중단 — heatwave 기본값 항상 보장, enabled 카드만 클릭 가능.

## 완료된 기능 (P8-T8-1 / T8-4 추가)
- **P8-T8-1: disaster registry/types 스캐폴딩** (2026-06-15):
  - `lib/disaster/types.ts` (신규) — DisasterType, RoleKey(5종), ROLE_LABELS, ROLEKEY_TO_DB_ROLE / DB_ROLE_TO_ROLEKEY 매핑.
  - `lib/disaster/registry.ts` (신규) — DISASTER_REGISTRY(폭염 situations 11개 등록, heavy_rain/infection은 enabled:false placeholder), getDisasterEntry/getEnabledDisasters.
  - `lib/types/wizard.ts` + `lib/hooks/useWizardState.ts` — WizardDraft.disaster_type 추가(기본 'heatwave').
- **P8-T8-4: 입력/route/결과 화면 registry·실 DB 전환** (2026-06-15):
  - T8-4a (UI): `components/plan/SituationPicker.tsx` registry 참조, `components/plan/PlanResult.tsx` role_based_actions 동적 역할 탭(+레거시 3탭 fallback, cook/health read-only).
  - T8-4b (실 DB): `lib/disaster/profileMapping.ts` (신규) riskProfileToHeatwave/heatwaveFormToRiskProfile 어댑터. `app/api/plan/generate/route.ts` 조회를 institution_risk_profiles로 전환 + action_requests INSERT risk_profile_id 사용. `app/api/institutions/[id]/profile/route.ts` GET/POST를 institution_risk_profiles(disaster_type='heatwave')로 전환.
  - typecheck + build 통과. 폭염 무중단.

## 완료된 기능 (P9-T9-2a 추가)
- **P9-T9-2a: 데이터/API 계층 재난유형 분기** (2026-06-15):
  - `lib/disaster/profileMapping.ts` — HeavyRainSpecific 인터페이스, HeavyRainProfile 타입, HeavyRainFormInput 타입 정의. riskProfileToHeavyRain() / heavyRainFormToRiskProfile() 추가. 폭염 경로 무중단.
  - `lib/ai/buildAiInput.ts` — AiInput에 heatwave_profile?(optional), heavy_rain_profile?(optional) 분기 구조. buildAiInput()이 disaster_type에 따라 화이트리스트 직렬화 분기. isInstitutionRiskProfile 타입가드 + buildDefaultHeavyRainProfile 비상 fallback. PII 0건 유지.
  - `app/api/plan/generate/route.ts` — 집중호우 프로필 없을 때 빈 InstitutionRiskProfile 기본값 생성(샘플 안전 처리). heavy_rain 시 InstitutionRiskProfile 그대로 전달(buildAiInput 내부 분기). 폭염은 riskProfileToHeatwave 변환 유지.
  - `app/api/institutions/[id]/profile/route.ts` — GET/POST에 `?disaster_type=` 쿼리 파라미터 지원. heavy_rain → heavyRainFormToRiskProfile/riskProfileToHeavyRain. 기본값 'heatwave' 기존 호환.
  - `lib/external/disasterSms.ts` — classifyDisasterType() 신규(DST_SE_NM/EMRG_STEP_NM/MSG_CN 키워드 기반). fetchRecentDisasterSms(sido, disasterType?) 시그니처 확장. V2 응답 구조 실제 검증 반영(json.body 배열, SN=number, CRT_DT 슬래시 형식). normalizeDateTime() KST +09:00 정규화. disaster_type 하드코딩 제거.
  - `app/api/external/disaster-sms/route.ts` — `?disaster_type=` 쿼리 파라미터 지원 추가.
  - `lib/external/weather.ts` — fetchWeatherContext() 3번째 인자 `_disasterType?: string | null` 추가(optional, 현재 구조 유지). 집중호우 강수 카테고리 확장은 미래 작업 주석 처리.
  - `npx tsc --noEmit` 오류 없음. `npm run build` 24개 라우트 정상 통과. 폭염 무중단 유지.

## 완료된 기능 (P9 추가)
- **P9: 집중호우 신규 재난유형 완료** (2026-06-15):
  - registry heavy_rain enabled:true (재난유형 선택 화면 집중호우 활성, 12개 상황).
  - `lib/ai/disaster/heavyRain.ts` — HEAVY_RAIN_POLICY_BLOCK + HEAVY_RAIN_OUTPUT_GUIDANCE. buildSystemPrompt 연결.
  - `lib/disaster/profileMapping.ts` — HeavyRainSpecific 인터페이스, HeavyRainProfile, HeavyRainFormInput, riskProfileToHeavyRain(), heavyRainFormToRiskProfile() 추가.
  - `components/institutions/ProfileForm.tsx` — ProfileForm disaster_type prop 분기(HeavyRainProfileForm 신규). ProfileTypeTabs 컴포넌트. profile 페이지 `?disaster_type=` 탭.
  - `components/plan/MessageInput.tsx` — 재난유형별 샘플 메시지(getSampleMessagesByType), 강도 배지 분기(HEAVY_RAIN_INTENSITY), API 조회 시 disaster_type 쿼리 전달.
  - `lib/sample/disaster_messages.ts` — SAMPLE_HEAVY_RAIN_MESSAGES 3종, getSampleMessagesByType() 함수.
  - `lib/external/disasterSms.ts` — classifyDisasterType() 함수, fetchRecentDisasterSms(sido, disasterType?) 시그니처 확장, getSampleItems 필터 로직.
  - `app/api/external/disaster-sms/route.ts` — `?disaster_type=` 파라미터 지원.
  - `lib/sample/results/heavyRain.ts` — SAMPLE_HEAVY_RAIN_AI_RESULT(5역할), SAMPLE_HEAVY_RAIN_ACTION_REQUEST.
  - `lib/sample/heavy_rain_profiles.ts` — SAMPLE_HEAVY_RAIN_PROFILES 2종(저지대·일반).
  - `app/api/plan/generate/route.ts` — USE_SAMPLE_FALLBACK 시 disaster_type 분기(heavy_rain → SAMPLE_HEAVY_RAIN_ACTION_REQUEST).
  - smoke-test 경로 B 추가(6개 체크).
  - 통합 QA: tsc --noEmit 오류 없음, npm run build 24개 라우트, smoke-test **36/36 통과**.

## 완료된 기능 (P10 T10-3 추가)
- **P10 T10-3: 감염병 시연 경로 C 완성 + 재난유형/프로필 탭 활성화** (2026-06-15):
  - `lib/sample/infection_profiles.ts` (신규) — InstitutionRiskProfile 구조 감염병 샘플 2종(has_health_room=true/false). PII 0건, 집계값/불리언/열거값만.
  - `lib/sample/index.ts` — SAMPLE_INFECTION_PROFILES, getSampleInfectionProfile export 추가.
  - `app/api/plan/generate/route.ts` — DB 프로필 없을 때 + DB 접근 실패 시 infection → SAMPLE_INFECTION_PROFILES[0] fallback(기존 빈 객체 → 실제 샘플로 교체).
  - `lib/disaster/registry.ts` — infection enabled: false → true (P10 T10-3 활성화).
  - `components/institutions/ProfileTypeTabs.tsx` — infection enabled: false → true (탭 활성화).
  - `lib/external/disasterSms.ts` — getSampleItems에 SAMPLE_INFECTION_MESSAGES 통합(폭염+집중호우+감염병 3유형).
  - `supabase/seed.sql` — 감염병 안내문자 2건, institution_risk_profiles 1건(has_health_room=true), action_request 1건(disaster_message_id=null, 5역할 result_json, 학부모 안내문), checklist_items 23건(director 6, teacher 5, shuttle 2, cook_or_food_service 4, health_manager 6). 멱등(ON CONFLICT DO NOTHING, 고정 UUID).
  - `scripts/smoke-test.mjs` — 경로 C(감염병 8개) + PII/안전 점검 2개 추가. 총 44개 체크.
  - `lib/sample/results/infection.ts` — 기존 완성본(T10-1 작성) 검증 완료(5역할, disaster_type='infection', disaster_message_id=null, safety_disclaimer, 낙인 없음, 확진 단정 없음).
  - typecheck(`npx tsc --noEmit`) 오류 없음. build(`npm run build`) 24개 라우트 정상.
  - **smoke-test 44/44 전 항목 통과** (USE_SAMPLE_FALLBACK=true, 포트 3000, 2026-06-15).

## 진행 중 기능
- (없음. P10 T10-3 완료.)

## 다음 작업
- **Vercel 배포 갱신** (사용자 직접): `git push origin master` → 자동 재배포. 환경변수 미변경이면 별도 설정 불필요.
- P10 완료 = 폭염·집중호우·감염병 3유형 전부 시연 가능.

## 주요 결정사항
- create-next-app 16.x가 CLAUDE.md를 생성(`@AGENTS.md` 포인터) → 우리 CLAUDE.md에 `@AGENTS.md` 포함으로 병합. D-009 기록.
- Next.js 16 = 버전 변경사항 있음(AGENTS.md 경고) → `node_modules/next/dist/docs/` 참조 필수.
- Tailwind v4 사용(CSS-based config, `@import "tailwindcss"`, `tailwind.config.js` 불필요). D-010.
- shadcn 4.x: Tailwind v4 지원, `toast` deprecated → `sonner` 사용. D-011.
- 상세 이력: `docs/08_DECISION_LOG.md`.

## 보류한 기능
- 추가 재난유형, Supabase Auth 실제 권한체계, 알림톡/재난문자 자동수신, 이미지/영상 분석, IoT — `docs/00_PRD.md` §7.

## 알려진 리스크
- AI JSON 파싱/타임아웃 실패 → **즉시** 재난유형별 샘플 fallback(`docs/04`). 재시도는 함수 504 유발로 제거(아래 참조).
- **[2026-06-16 AI 디버깅 일련: ea2901a → 4cbe490 → fa4f0f0]**
  - (1) fallback이 폭염 SAMPLE_AI_RESULT 고정이던 버그 → `sampleResultFor(disaster_type)`로 유형별 샘플 반환(ea2901a).
  - (2) 5역할 role_based_actions 출력이 4096 토큰 초과로 잘림 → `max_tokens` 8192 상향(4cbe490).
  - (3) 5역할 생성이 20s+ 소요 → 1차 timeout 후 재시도가 함수 30s를 초과해 504(FUNCTION_INVOCATION_TIMEOUT). **callClaude 재시도 제거(단일 시도, TIMEOUT 45s)** + `vercel.json` generate `maxDuration` 30→60s(fa4f0f0).
- **[프로덕션 env]** ANTHROPIC_API_KEY **추가 완료** + ANTHROPIC_MODEL을 `claude-haiku-4-5-20251001`로 재설정. 실 AI 생성 정상 확인(감염병 ~45s=TIMEOUT 한계 → 간헐 샘플 fallback 가능, 폭염 ~31s, 둘 다 is_fallback=false). 실패 시 유형별 샘플로 안전(504 없음).
- 공공 API 키 발급 지연/장애 → 샘플 모드 자동 전환(`docs/03`).
- 시연 네트워크 불안정 → `USE_SAMPLE_FALLBACK=true` 오프라인 데모.
- Next.js 16의 새 API 변경사항 → 구현 전 `node_modules/next/dist/docs/` 항상 확인.
- **[P8 해소]** buildAiInput.ts의 `AiInput.disaster_type` — P9/P10에서 분기 구조 완성. 3유형 모두 정상 동작.
- **[P11 해소]** cook_or_food_service/health_manager 역할 ROLEKEY_TO_DB_ROLE 매핑 완료. PlanResult에서 5역할 모두 ChecklistCard(토글) 렌더링. 0002 DB CHECK 확장 적용 완료.
- **[P11 완료, 2026-06-16]** 진입 역할(홈/AppHeader) 5종+admin 확장, roleRecommendation(법적 단정 금지) + 급식·보건 인력 입력(staff_profile), 대시보드 재난유형별·역할 현황. **0003_role_expansion.sql 원격 적용 완료**(Management API) — action_requests.created_by_role CHECK 6종 검증. docs 00~06·09·10 + docs/11 + decision log(D-013~016) 갱신 완료.
- **[P8 해소]** 0002_disaster_expansion.sql 원격 DB **적용 완료**(Management API, 2026-06-15). institution_risk_profiles 이관 검증 완료. (로컬 supabase/migrations 파일과 원격 상태 일치 — 이후 CLI 도입 시 마이그레이션 히스토리 정합성만 유의.)
- **[P9 해소]** 포트 충돌 이슈 해소 — 시연 전 빈 포트(예: 3099) 또는 `USE_SAMPLE_FALLBACK=true`로 새 포트에서 기동.
- **[P9 확인, 저위험]** MOIS API 키 설정 + heavy_rain 필터 시: 실제 API 결과에 heavy_rain 분류 항목이 없으면 heavy_rain 샘플 3종 fallback(정상 동작). MOIS 키 없으면 즉시 샘플 fallback(6종 → 필터 후 3종).
- **[P10 해소]** SituationPicker infection situations 12개로 정상 진입(registry enabled:true). heavy_rain situations 12개 정상.
- **[QA-2026-06-16 사소 주의]** /plan/new/type 클라이언트 컴포넌트로 SSR HTML에 Korean 카드 텍스트 미포함(JS 번들에서 렌더) — 정상 동작. 크롤러 노출 불필요.
- **[QA-2026-06-16 해소(T11-5)]** AppHeader ROLE_LABELS 5종+admin 등록 완료, 홈 역할 선택(app/page.tsx) 6카드(조리사/보건 추가). created_by_role 0003 적용으로 진입 역할 실 DB 저장 가능.
- **[QA-2026-06-16 사소 주의]** 재난유형 선택 후 새로고침 시 sessionStorage 기반 WizardDraft 초기화 가능 — 시연 중 새로고침 자제 안내 필요.

## 스택 확정 (P0 기준)
| 항목 | 버전/패키지 |
|---|---|
| Next.js | 16.2.9 (Turbopack 기본) |
| React | 19.2.4 |
| Tailwind CSS | v4 (`@tailwindcss/postcss`, CSS-based) |
| shadcn/ui | 4.x (sonner, badge, card, separator) |
| Supabase | `@supabase/supabase-js` + `@supabase/ssr` |
| AI | `@anthropic-ai/sdk` |
| 스키마 검증 | `zod` |
| 아이콘 | `lucide-react` |

## 샘플 데이터 상태
- `lib/sample/` 완료: institutions(3), heatwave_profiles(3), disaster_messages(3), action_results(1 fallback).
- `supabase/seed.sql` 완료: Supabase 연결 시 동일 데이터 적용 가능.
- `lib/types/db.ts` 완료: Institution(+staff_profile), HeatwaveProfile, InstitutionRiskProfile(신규), DisasterMessage, ActionRequest(+risk_profile_id), ChecklistItem, AfterActionRecord(+disaster_type/checked_items), AiPlanResult, DisasterType(신규).

## API 연동 상태
- `/api/institutions` (GET/POST), `/api/institutions/[id]/profile` (GET/POST) 완료.
- `POST /api/plan/generate` — Claude claude-haiku-4-5-20251001 호출, 12s 타임아웃, 1회 재시도, 샘플 fallback. ANTHROPIC_API_KEY 미설정 시 샘플 즉시 반환.
- `PATCH /api/plan/[requestId]/checklist/[itemId]` — 체크리스트 토글.
- `GET|POST /api/plan/[requestId]/after-action` — 사후기록 조회/저장(upsert). 샘플 모드 + DB 실패 시 graceful 처리.
- `GET /api/admin/stats`, `GET /api/admin/plans` — 관리자 집계/목록.
- `GET /api/external/geocode?query=` — Kakao Local API 주소→좌표. GEOCODE_API_KEY 미설정 시 샘플 좌표.
- `GET /api/external/weather?lat=&lng=` — KMA 초단기예보 → 실온/체감온도/습도. KMA_API_KEY 미설정 시 샘플.
- `GET /api/external/disaster-sms?sido=` — 행안부 긴급재난문자. MOIS_DISASTER_API_KEY 미설정 시 샘플 3종.
- `GET /api/external/weather/impact?sido=` — 기상청 폭염영향예보. KMA_API_KEY 미설정 시 샘플.
- 모든 라우트: service_role 키 사용, `USE_SAMPLE_FALLBACK=true` 시 즉시 샘플 반환.

## 마지막 정상 시연 흐름 (QA 갱신 포함)
- **2026-06-15 (프로덕션)** — Vercel 프로덕션 스모크 테스트 **25/25 통과**.
  - URL: https://disastersafety.vercel.app
  - 경로: / → /institutions → /plan/new → /plan/new/message → /plan/new/situation → POST /api/plan/generate → /plan/[id] → PATCH checklist → /plan/[id]/after-action → POST after-action → /admin → /admin/institutions/[id]
  - 공공 API 실 연동 확인:
    - Kakao 지오코딩: **source:api** (서울종로구 → lat:37.57, lng:126.97)
    - KMA 초단기예보: **source:api** (temp:20℃, feels_like:22.3℃, humidity:75%)
    - KMA 폭염영향예보 V2: **source:api** (level:medium / 주의) ← 엔드포인트 수정 완료
    - MOIS 재난문자: source:sample (MOIS_DISASTER_API_KEY 미설정 — 선택적)
  - KMA 영향예보 엔드포인트 수정: `HeatWaveLifeIndex/getHeatWaveLifeIndex` → `ImpactInfoServiceV2/getHWImpactValueV2` (필수 파라미터: `tm`)
  - 보건(취약인) 기준 필터링, 시도별 지역 필터, 최고 수준 선택 로직 적용.
- **2026-06-15 (오프라인)** — `USE_SAMPLE_FALLBACK=true` 오프라인 모드로 스모크 테스트 **30/30 통과** (P6 포함).
  - 스크립트: `USE_SAMPLE_FALLBACK=true node scripts/smoke-test.mjs`
- **2026-06-15 (P8 회귀검증)** — `USE_SAMPLE_FALLBACK=true` 오프라인 모드로 P8 리팩터링 후 폭염 시연 경로 회귀검증 **전 항목 PASS**.
  - 커밋: 831bd49 (P8 완료 상태)
  - 경로: / → /institutions → /plan/new → /plan/new/type(신규) → /plan/new/message → /plan/new/situation → POST /api/plan/generate → /plan/[id] → /plan/[id]/after-action → /admin
  - 전 UI 라우트 10개 HTTP 200, API GET 라우트 5개 200, POST generate/after-action 정상
  - disaster_type='heatwave' 일관 흐름 확인: EMPTY_DRAFT 기본값 → WizardDraft → generate body → SAMPLE_AI_RESULT.disaster_type
  - role_based_actions 5역할 정상 반환, legacyAdapter director/teacher/shuttle 3필드 동시 보장
  - is_fallback=true + model='sample' 배지 확인
  - tsc --noEmit 오류 없음, npm run build 24개 라우트 정상
- **2026-06-15 (P9 통합 QA)** — `USE_SAMPLE_FALLBACK=true` 오프라인 모드로 P9 집중호우 추가 후 폭염+집중호우 통합 검증 **smoke-test 36/36 전 항목 PASS**.
  - 경로 A(폭염) + 경로 B(집중호우) 전 항목 정상.
  - disaster-sms 필터: `?disaster_type=heavy_rain` → heavy_rain 3종, heatwave 3종, 필터 없음 → 6종 전체.
  - tsc --noEmit 오류 없음, npm run build 24개 라우트 정상.
- **2026-06-15 (P10 T10-3 통합 QA)** — `USE_SAMPLE_FALLBACK=true` 오프라인 모드로 P10 감염병 추가 후 3유형 통합 검증 **smoke-test 44/44 전 항목 PASS**.
  - 경로 C(감염병 8개): POST /api/plan/generate(disaster_type=infection, disaster_message_id=null) → 5역할 반환, disaster_type='infection', safety_disclaimer, source='sample', disaster_message_id=null 허용. GET /api/external/disaster-sms?disaster_type=infection → 감염병 샘플 2종. GET /plan/{id} 200 OK.
  - PII/안전 점검 2개: infection 결과에 전화번호/진단명/확진 단정 표현 없음. generate 응답에 PII 없음.
  - disaster-sms 필터: 3유형(heatwave 3종 + heavy_rain 3종 + infection 2종) 필터 정상.
  - infection enabled=true: 재난유형 선택 화면 감염병 카드 활성, 프로필 탭 활성.
  - isInfection 로직: disaster_message_text 비어도 400 오지 않음(재난문자 없이 상황만으로 허용).
  - tsc --noEmit 오류 없음, npm run build 24개 라우트 정상 (경로 A+B+C 포함).
- **2026-06-16 (최종 종합 QA — P8~P11 완료 후)** — `USE_SAMPLE_FALLBACK=true` 오프라인 모드, 포트 3099, **smoke-test 44/44 전 항목 PASS**. 커밋: 831bd49 기준.
  - tsc --noEmit: 오류 0건.
  - npm run build: 24개 라우트 정상(/ + /_not-found + 22개 ○/ƒ). TypeScript 컴파일 2.9s.
  - 3유형 × 5역할 샘플 시연: 경로 A(폭염)+B(집중호우)+C(감염병) 전 경로 완주 확인.
  - 5역할 탭/토글: PlanResult role_based_actions 기반 동적 탭 5개+parent. ROLEKEY_TO_DB_ROLE 5역할 전부 ChecklistCard(토글) 경로.
  - 역할 추천(roleRecommendation): getRoleRecommendations 순수함수 검증. 어린이집 40명+ 조리원, 100명+ 보건, 유치원 36학급+ 보건교사 — check_required 톤("확인이 필요합니다") 준수.
  - 관리자 대시보드: DisasterTypeSummary 3유형 건수 뱃지+막대 표시. 기관 역할 지정 현황 표시.
  - fallback: USE_SAMPLE_FALLBACK=true 체크리스트 토글 "local" source, generate source='sample', is_fallback=true 배지 정상.
  - 안전/PII: safety_disclaimer "공식기관 지시와 119" 3유형 전부 포함. "의료 진단은 의료기관과 보건당국의 권한" 단정금지 문구 정상(단정 아님). 감염병 확진 단정 없음. 전화번호 PII 없음.
  - 모바일: max-w-2xl 단일 컬럼, min-h-[44px]/[48px] 터치 타깃, 복사 버튼(navigator.clipboard) 정상.
  - P7 회귀 없음: 폭염 경로 legacyAdapter director_checklist 동시 보장, disaster_type='heatwave' 일관.
  - 샘플/API 상태: USE_SAMPLE_FALLBACK=true → 전 외부 의존 차단, 전 흐름 동작 확인.

## 다음 세션 시작 프롬프트 (복붙용)
```
재난안전MVP 작업을 이어간다. 먼저 CLAUDE.md와 docs/07_CONTEXT_LEDGER.md를 읽고 현재 상태를 파악하라.

P0~P10 T10-3 완료 (감염병 신규 경로 추가 + 통합 QA 44/44 통과).
- P10 T10-3 완료 항목:
  - lib/sample/infection_profiles.ts (신규): 감염병 샘플 프로필 2종
  - lib/sample/index.ts: SAMPLE_INFECTION_PROFILES, getSampleInfectionProfile export
  - lib/disaster/registry.ts: infection enabled:true 전환
  - components/institutions/ProfileTypeTabs.tsx: infection enabled:true 전환
  - lib/external/disasterSms.ts: getSampleItems에 SAMPLE_INFECTION_MESSAGES 통합
  - supabase/seed.sql: 감염병 메시지 2건 + 프로필 1건 + action_request + checklist 23건
  - scripts/smoke-test.mjs: 경로 C 8개 + PII 점검 2개 = 총 44개 체크
  - app/api/plan/generate/route.ts: infection DB fallback SAMPLE_INFECTION_PROFILES 사용

완료 확인:
- npx tsc --noEmit 오류 없음
- npm run build 24개 라우트 정상
- smoke-test 44/44 통과 (USE_SAMPLE_FALLBACK=true, 포트 3000, 2026-06-15)
- 폭염·집중호우 회귀 없음, 감염병 신규 경로 C 정상

시연 직전 필수:
- USE_SAMPLE_FALLBACK=true로 서버 기동
- smoke-test 재실행으로 44/44 확인

배포 URL: https://disastersafety.vercel.app
배포 갱신: git push origin master → Vercel 자동 재배포
환경변수: 전부 설정 완료 (ANTHROPIC, Supabase, Kakao, KMA, MOIS)
0002 원격 DB 적용 완료. institution_risk_profiles 이관 검증 완료.
```
