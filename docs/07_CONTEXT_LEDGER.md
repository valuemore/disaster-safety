# 07_CONTEXT_LEDGER — 컨텍스트 원장(세션 연속성)

> 세션이 길어져도 개발 맥락을 잃지 않기 위한 **단일 요약 문서**.
> **운영 규칙**: 큰 작업/슬라이스를 마칠 때마다, 그리고 세션 종료 시 이 문서를 갱신한다. "다음 세션 시작 프롬프트"는 항상 최신화한다.
>
> 최종 업데이트: **2026-06-15** / 업데이트 주체: P5 관리자 대시보드 완료

---

## 현재 MVP 목표
폭염 재난문자 → 유아교육기관 역할별 체크리스트/학부모 안내문/사후기록 변환 웹 MVP. 공모전 제출용 작동형 시제품. 데모 본선(P0–P4) 우선.

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
  - 스모크 테스트 S0→S9 **25/25 통과** (2026-06-15).
- typecheck + build 통과(19개 라우트).

## 진행 중 기능
- (없음) — P0~P4 데모 본선 완료.

## 다음 작업
- **P6 공공 API(T-060~063, 가산점)**: 기상청 단기예보 API → weather_context 주입.
- **P7 배포(T-070~072)**: Vercel + Supabase 프로덕션, 환경변수 세팅.
- hooks 적용: `.claude/settings.json` 검토. `docs/10_HARNESS_PLAN.md` §3 참조.

## 주요 결정사항
- create-next-app 16.x가 CLAUDE.md를 생성(`@AGENTS.md` 포인터) → 우리 CLAUDE.md에 `@AGENTS.md` 포함으로 병합. D-009 기록.
- Next.js 16 = 버전 변경사항 있음(AGENTS.md 경고) → `node_modules/next/dist/docs/` 참조 필수.
- Tailwind v4 사용(CSS-based config, `@import "tailwindcss"`, `tailwind.config.js` 불필요). D-010.
- shadcn 4.x: Tailwind v4 지원, `toast` deprecated → `sonner` 사용. D-011.
- 상세 이력: `docs/08_DECISION_LOG.md`.

## 보류한 기능
- 추가 재난유형, Supabase Auth 실제 권한체계, 알림톡/재난문자 자동수신, 이미지/영상 분석, IoT — `docs/00_PRD.md` §7.

## 알려진 리스크
- AI JSON 파싱 실패 → 재시도+샘플 fallback(`docs/04`).
- 공공 API 키 발급 지연/장애 → 샘플 모드 자동 전환(`docs/03`).
- 시연 네트워크 불안정 → `USE_SAMPLE_FALLBACK=true` 오프라인 데모.
- Next.js 16의 새 API 변경사항 → 구현 전 `node_modules/next/dist/docs/` 항상 확인.

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
- `lib/types/db.ts` 완료: Institution, HeatwaveProfile, DisasterMessage, ActionRequest, ChecklistItem, AfterActionRecord, AiPlanResult.

## API 연동 상태
- `/api/institutions` (GET/POST), `/api/institutions/[id]/profile` (GET/POST) 완료.
- `POST /api/plan/generate` — Claude claude-haiku-4-5-20251001 호출, 12s 타임아웃, 1회 재시도, 샘플 fallback. ANTHROPIC_API_KEY 미설정 시 샘플 즉시 반환.
- `PATCH /api/plan/[requestId]/checklist/[itemId]` — 체크리스트 토글.
- `GET|POST /api/plan/[requestId]/after-action` — 사후기록 조회/저장(upsert). 샘플 모드 + DB 실패 시 graceful 처리.
- 모든 라우트: service_role 키 사용, `USE_SAMPLE_FALLBACK=true` 시 즉시 샘플 반환.
- 공공 API 미연동 (P6 예정).

## 마지막 정상 시연 흐름
- **2026-06-15** — `USE_SAMPLE_FALLBACK=true` 오프라인 모드로 S0→S9 스모크 테스트 **25/25 통과**.
  - 경로: / → /institutions → /plan/new → /plan/new/message → /plan/new/situation → POST /api/plan/generate → /plan/[id] → PATCH checklist → /plan/[id]/after-action → POST after-action → /admin → /admin/institutions/[id]
  - 스크립트: `USE_SAMPLE_FALLBACK=true node scripts/smoke-test.mjs`
  - PII 0건 확인, safety_disclaimer 고정 문구 주입 확인, 입력 검증(400) 확인, 관리자 stats/plans API 확인.

## 다음 세션 시작 프롬프트 (복붙용)
```
재난안전MVP 작업을 이어간다. 먼저 CLAUDE.md와 docs/07_CONTEXT_LEDGER.md를 읽고 현재 상태를 파악하라.

P0~P5 완료. 데모 본선(S0→S9) 전 흐름 구현 완성.
데모 흐름: / → /plan/new → /plan/new/message → /plan/new/situation → /plan/[id] → /plan/[id]/after-action → /admin → /admin/institutions/[id]

빌드: 19개 라우트 정상(2026-06-15 기준). 스모크 테스트 25/25 통과.
ANTHROPIC_API_KEY를 .env.local에 설정하면 실제 AI가 동작하고, 미설정 시 샘플 데이터로 전 흐름이 동작한다.

다음 작업 후보:
  1. P6 공공 API(T-060~063, 가산점) — 기상청 단기예보 API → weather_context 주입.
  2. P7 배포(T-070~072) — Vercel + Supabase 프로덕션, 환경변수 세팅.
  3. P7 모바일 마감(T-071) — 반응형·로딩·에러 상태 점검.

구현 전 반드시 관련 docs/를 먼저 읽고, /mvp-slice 절차를 따른다.
완료 후 이 Ledger를 갱신한다.
```
