# 08_DECISION_LOG — 결정 이력

> 프로젝트 의사결정을 **append-only**로 기록한다(절대날짜 사용). 형식: 날짜 / 결정 / 이유 / 대안 / 영향.
> 업데이트 시점: 의미 있는 결정이 생길 때마다.

---

### D-001 — 2026-06-15 — 1차 재난유형은 폭염만 구현
- **결정**: MVP는 폭염만. 호우·대설·화재·감염병·미세먼지는 확장 문서로만.
- **이유**: 공모전 데모 흐름을 한 유형으로 끝까지 안정화하는 것이 우선.
- **대안**: 다유형 동시 구현(범위 과다, 시연 리스크↑) → 기각.
- **영향**: `disaster_type` 컬럼/프롬프트 분기로 확장 여지만 확보. `docs/00`,`02`,`04`.

### D-002 — 2026-06-15 — AI 제공자 = Anthropic Claude
- **결정**: 기본 `claude-haiku-4-5`, 고품질 필요 시 `claude-sonnet-4-6`.
- **이유**: JSON 출력 안정성·비용 효율·Claude Code 환경 일관성.
- **대안**: OpenAI, 멀티 프로바이더 추상화(작업량↑) → 기각/보류.
- **영향**: `docs/04`, env `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`.

### D-003 — 2026-06-15 — 인증 = 시연용 역할 선택
- **결정**: 로그인 없이 역할(지자체/원장/담임/통학버스) 버튼 선택.
- **이유**: 시연 흐름 단절 최소화, 인증 실패 리스크 제거.
- **대안**: Supabase Auth → 운영 단계로 보류.
- **영향**: `docs/02` RLS 단순화(서버 라우트 경유), `docs/05` 진입점.

### D-005 — 2026-06-16 — 전면 리팩토링: 실서비스형 흐름 + 로그인 시작
- **결정**: 역할선택 시작 → **간편 기관 로그인(등록번호+PIN, 쿠키 세션)** 시작으로 전환. 화면 샘플 선택 UI 제거(백엔드 USE_SAMPLE_FALLBACK은 유지). 재난유형 **AI 자동분류**(수동선택 단계 제거). 결과를 체크리스트/사후기록 → **읽기전용 역할별 대응계획**으로. 공유(링크/인쇄/문자/알림톡) 추가. 관리자 1,000기관 대비 페이지네이션.
- **이유**: MVP라도 실제 사용 시나리오(지자체 발송→원장 로그인)에 맞춤. D-003(역할선택 인증)을 대체.
- **대안**: Supabase Auth 풀스택(시연 복잡도↑) → 보류. 기관 식별만(인증 없음) → 실서비스성 약화. 간편 PIN 로그인 절충 채택.
- **영향**: `proxy.ts`, `lib/auth/*`, `app/{login,register,account}`, `app/api/auth/*`, `0004` 마이그레이션. D-001/D-003 일부 대체. 계획 `~/.claude/plans/vivid-orbiting-leaf.md`.

### D-006 — 2026-06-16 — 교직원 업무 연락처 저장 허용(공유·발송 한정)
- **결정**: 대응계획 공유·발송을 위해 **교직원(역할별 담당자) 휴대폰/이메일**을 수신동의와 함께 `institution_staff_contacts`에 저장 허용. 보호자(학부모) 연락처는 계속 저장 금지. AI 입력 화이트리스트엔 연락처 미포함.
- **이유**: 공유 기능 요구사항 충족. 학부모 PII 금지 원칙은 유지.
- **대안**: 저장 안 함(발송 시 매번 입력) → UX 저하. 학부모까지 저장 → PIPA 리스크로 기각.
- **영향**: `CLAUDE.md` 개인정보 원칙 예외 명시. RLS anon SELECT 없음(service_role 전용). `docs/02`.

### D-004 — 2026-06-15 — 공공 API는 "가능한 많이" 연동(단, 전 기능 fallback 필수)
- **결정**: 우선순위(주소·좌표 → 단기예보 → 영향예보/재난문자 → 기관정보)대로 단계 연동.
- **이유**: 가산점 최대화. 단 데모 안정성은 절대 유지.
- **대안**: 전부 샘플 → 가산점 약화. 무리한 전면 연동 → 데모 리스크. 절충 채택.
- **영향**: `docs/03`. 모든 API 실패 시 샘플 자동 전환.

### D-005 — 2026-06-15 — 저장소 = Supabase 우선 + 샘플 fallback
- **결정**: 실제 Supabase PostgreSQL 사용, 실패 시 in-memory 샘플 시드.
- **이유**: 실제 동작 입증 + 시연 무중단.
- **영향**: `docs/02`.

### D-006 — 2026-06-15 — 운영체계(Operating System) 세팅 도입
- **결정**: CLAUDE.md(간결) + Context Ledger/Decision Log + Skills 5 + Subagents 6 + Harness/Hooks 설계 문서.
- **이유**: 컨텍스트 효율·세션 연속성·역할 분리로 빠르고 안전한 개발.
- **영향**: `CLAUDE.md`, `docs/07~10`, `.claude/skills`, `.claude/agents`.

### D-007 — 2026-06-15 — Hooks는 P0 스캐폴딩 이후 적용
- **결정**: 이번 라운드에 `.claude/settings.json` 미생성. `docs/10`에 설계만.
- **이유**: prettier/tsc 등 도구가 아직 미설치 → 존재하지 않는 도구 호출 실패 방지.
- **대안**: 가드 포함해 지금 작성 → 스캐폴딩 전엔 실질 무동작 → 보류.
- **영향**: `docs/10`, 후속 P0 완료 시 적용 검토.

### D-008 — 2026-06-15 — Subagent 모델 역할별 혼합
- **결정**: builder/engineer = sonnet, planner/reviewer/qa = haiku.
- **이유**: 품질 필요처(코드 생성)에만 고성능, 검토/계획/QA는 비용 효율.
- **영향**: `.claude/agents/*.md` frontmatter `model`.

### D-009 — 2026-06-15 — create-next-app 16.x CLAUDE.md 병합
- **결정**: create-next-app 16.x가 `CLAUDE.md`(`@AGENTS.md` 포인터)와 `AGENTS.md`(Next.js 16 규칙)를 생성 → 우리 CLAUDE.md 앞에 `@AGENTS.md` 포함하여 병합. AGENTS.md는 보존.
- **이유**: AI 코딩 보조 도구가 Next.js 16 변경사항을 항상 인지해야 함. create-next-app의 CLAUDE.md를 무시하면 AI가 잘못된 API를 사용할 위험.
- **영향**: `CLAUDE.md`, `AGENTS.md` 파일 구조.

### D-010 — 2026-06-15 — Tailwind CSS v4 (CSS-based config)
- **결정**: Tailwind v4를 사용. `tailwind.config.js` 없음, `@import "tailwindcss"` + `@theme inline {}` CSS-based.
- **이유**: create-next-app 16.x 기본 설정. shadcn 4.x도 Tailwind v4 지원.
- **대안**: v3 downgrade → 필요 없음.
- **영향**: `app/globals.css`, 커스텀 색상/테마는 CSS 변수로 관리.

### D-011 — 2026-06-15 — shadcn `toast` deprecated → `sonner` 사용
- **결정**: shadcn의 `toast` 컴포넌트 대신 `sonner`를 사용.
- **이유**: shadcn 4.x에서 toast deprecated, sonner가 후속.
- **영향**: `components/ui/sonner.tsx`, `app/layout.tsx`의 `<Toaster>`.

### D-012 — 2026-06-15 — Next.js 16 구현 전 내장 docs 확인 원칙
- **결정**: 모든 Next.js API 사용 전 `node_modules/next/dist/docs/`를 확인한다.
- **이유**: AGENTS.md 경고: "This is NOT the Next.js you know. APIs, conventions, and file structure may all differ."
- **영향**: CLAUDE.md 작업 규칙, 모든 구현 단계.

### D-013 — 2026-06-15 — 재난유형 3종 + 역할 5종 확장 (D-001 보완)
- **결정**: 폭염 단일에서 **폭염·집중호우·감염병** 3종으로, 역할은 원장·담임교사·통학버스담당자 + **조리사/급식담당자·보건담당자** 5종으로 확장. 공통 구조와 재난유형별 구조를 분리(레지스트리 패턴).
- **이유**: 공모전 제품 경쟁력 강화. 단 폭염 데모 안정화(D-001) 이후 공통화 기반으로 확장하여 회귀 리스크 최소화.
- **대안**: 폭염 구조 복사 후 유형별 중복 개발 → 유지보수성·일관성 저하로 기각.
- **영향**: `docs/11_DISASTER_TYPE_EXPANSION_PLAN.md`(신규 SSOT), `lib/disaster/*`, `docs/00,02,04,05,06`. 구현 순서 P8(공통화)→P9(집중호우)→P10(감염병)→P11(역할).

### D-014 — 2026-06-15 — 재난유형 프로필 저장 = 선택지 C (공통컬럼 + JSONB)
- **결정**: `institution_risk_profiles` 범용 테이블 — 공통 위험대응 컬럼 + `disaster_specific` JSONB + disaster_type + is_current. 기존 heatwave_profiles는 데이터 이관 후 레거시 보존.
- **이유**: 재난유형 확장 시 마이그레이션 거의 불필요(JSONB) + 공통 조회 로직 재사용. MVP 개발속도와 확장성 균형.
- **대안**: A(유형별 테이블 분리 — 코드 3배), B(전부 JSONB — 타입 안정성↓). 균형안 C 채택.
- **영향**: `supabase/migrations/0002_disaster_expansion.sql`, `lib/disaster/profileMapping.ts`, `lib/types/db.ts`.

### D-015 — 2026-06-15 — AI 출력 = role_based_actions 배열 + 레거시 호환
- **결정**: AI 출력의 역할별 체크리스트를 고정 필드(director/teacher/shuttle_checklist)에서 `role_based_actions[]` 동적 배열로 전환. 기존 필드는 `legacyAdapter`(ensureLegacyChecklists)로 파생 유지.
- **이유**: 역할 N개 확장 시 스키마 변경 불필요. 기존 폭염 소비처(PlanResult·checklist_items·after-action) 무중단.
- **대안**: 고정 필드 5개로 확장 → 역할 추가 때마다 스키마 수정 필요. 기각.
- **영향**: `lib/ai/aiPlanSchema.ts`, `lib/ai/legacyAdapter.ts`, `lib/ai/buildSystemPrompt.ts`, `components/plan/PlanResult.tsx`.

### D-016 — 2026-06-15 — 마이그레이션 적용 = Supabase Management API (access token)
- **결정**: 0002 마이그레이션을 Supabase Management API(`POST /v1/projects/{ref}/database/query`) + personal access token으로 적용.
- **이유**: service_role 키는 PostgREST 인증용이라 DDL 실행 불가. 프로젝트에 pg 드라이버·supabase CLI·psql 미설치. Management API가 추가 설치 없이 가장 빠른 경로.
- **대안**: DB connection string(pg) — 비밀번호 노출↑. 대시보드 수동 실행 — 자동화 불가. CLI — 설치·링크 필요.
- **영향**: 운영 절차. `SUPABASE_ACCESS_TOKEN` env(.env.local, 서버 전용). 향후 마이그레이션 동일 경로 권장.

<!-- 새 결정은 D-0xx로 아래에 append -->
