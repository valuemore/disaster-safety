# 10_HARNESS_PLAN — 하네스(Harness) 및 Hooks 설계

> 공모전 MVP는 **시연 안정성**이 핵심. 본 문서는 시연을 떠받치는 하네스(샘플 데이터·검증·스모크 테스트)와 자동화 hooks 설계를 정의한다.
> 업데이트 시점: harness/hooks 변경 시. 실제 fixture/스크립트 코드는 P0–P3에서 구현, P8–P11에서 3유형×5역할로 확장(여기는 설계·완료조건).
> 현재 상태(2026-06-16): **3유형(폭염·집중호우·감염병) × 5역할(원장·담임교사·통학버스·조리사/급식·보건담당자) 완성. smoke-test 44/44 통과.**

---

## 1. Harness 구성 요소 · 구현 위치 · 완료조건

| 구성 | 내용 | 구현 위치 | 구현 Phase | 완료조건(DoD) |
|---|---|---|---|---|
| 샘플 기관 데이터 | 3~5곳(어린이집/유치원, 통학버스 유무, staff_profile 포함) | `lib/sample/institutions.ts` / `supabase/seed.sql` | P1 | DB·in-memory 양쪽에서 동일 조회 |
| 샘플 폭염 재난문자 | 주의보/경보/야외자제 3종 | `lib/sample/disaster_messages.ts` | P2 | S3에서 선택 가능 |
| 샘플 집중호우 재난문자 | 호우경보 등 3종 | `lib/sample/disaster_messages.ts` `SAMPLE_HEAVY_RAIN_MESSAGES` | P9 | `?disaster_type=heavy_rain` 필터로 반환 |
| 샘플 감염병 안내문자 | 보건당국 안내 2종 | `lib/sample/disaster_messages.ts` `SAMPLE_INFECTION_MESSAGES` | P10 | `?disaster_type=infection` 필터로 반환 |
| 샘플 현재상황 조합 | 재난유형별 대표 3세트 (폭염/집중호우/감염병) | `scripts/smoke-test.mjs` 내 wizardDraft · heavyRainDraft · infectionDraft | P2,P9,P10 | 경로 A/B/C smoke-test 커버 |
| 샘플 폭염 AI 결과 | 5역할 role_based_actions, disaster_type='heatwave' | `lib/sample/action_results.ts` `SAMPLE_AI_RESULT` | P3/P8 | 파싱 실패/오프라인 시 동일 결과 렌더 |
| 샘플 집중호우 AI 결과 | 5역할 role_based_actions, disaster_type='heavy_rain' | `lib/sample/results/heavyRain.ts` `SAMPLE_HEAVY_RAIN_AI_RESULT` | P9 | heavy_rain fallback 결과로 사용 |
| 샘플 감염병 AI 결과 | 5역할 role_based_actions, disaster_type='infection', disaster_message_id=null | `lib/sample/results/infection.ts` `SAMPLE_INFECTION_AI_RESULT` | P10 | infection fallback 결과로 사용, safety_disclaimer 포함 |
| 샘플 집중호우 프로필 | institution_risk_profiles 구조, 저지대·지하공간 케이스 2종 | `lib/sample/heavy_rain_profiles.ts` `SAMPLE_HEAVY_RAIN_PROFILES` | P9 | generate route DB fallback에서 사용 |
| 샘플 감염병 프로필 | institution_risk_profiles 구조, has_health_room 유무 2종 | `lib/sample/infection_profiles.ts` `SAMPLE_INFECTION_PROFILES` | P10 | generate route DB fallback에서 사용 |
| JSON schema validation | zod 스키마 (`AiPlanSchema` — role_based_actions, disaster_type, checked_items) | `lib/ai/aiPlanSchema.ts` | P3/P8 | 유효/무효 케이스 테스트 통과. legacyAdapter 파생 보장. |
| 3분 시연 smoke test 44개 | 경로 A(폭염)+B(집중호우)+C(감염병)+P6(API)+PII 점검 | `scripts/smoke-test.mjs` | P3/P8/P9/P10 | 44/44 통과 (USE_SAMPLE_FALLBACK=true) |
| API 실패 시나리오 테스트 | `USE_SAMPLE_FALLBACK=true` / 키 제거 | smoke-test 내 외부 API fallback 체크 | P6 | 3유형 전 흐름 동작, source 메타 확인 |
| 모바일 화면 기본 확인 | 세로 단일 컬럼·터치 타깃(44~48px)·복사 버튼 | 수동 체크리스트(09_DEMO_SCRIPT.md) | P4/P7 | 모바일 폭 정상, 5역할 탭 스크롤 정상 |
| "마지막 정상 시연" 기록 | 날짜·경로·커밋 | `docs/07_CONTEXT_LEDGER.md` | P3+ | 갱신 운영 |

### 설계 원칙

- 샘플 데이터는 **단일 출처(single source)**: `lib/sample/*`가 DB 시드와 in-memory fallback의 공통 원본. `docs/02`·`docs/04` 값과 항상 일치.
- 모든 fallback 경로는 결과에 `source: 'sample' | 'api' | 'db'`, `is_fallback` 메타를 남겨 UI 배지로 투명하게 표시.
- `callClaude.ts`는 `disaster_type`에 따라 유형별 샘플 fallback을 자동 선택: `heatwave` → SAMPLE_AI_RESULT, `heavy_rain` → SAMPLE_HEAVY_RAIN_AI_RESULT, `infection` → SAMPLE_INFECTION_AI_RESULT.

---

## 2. 샘플 파일 구조 (`lib/sample/`)

```
lib/sample/
  institutions.ts          (기관 3~5곳 — 어린이집/유치원, 통학버스 유무)
  disaster_messages.ts     (폭염 3종 + 집중호우 3종 + 감염병 2종 + getSampleMessagesByType())
  heatwave_profiles.ts     (폭염 프로필 3종 — HeatwaveProfile 구조)
  heavy_rain_profiles.ts   (집중호우 프로필 2종 — InstitutionRiskProfile 구조)
  infection_profiles.ts    (감염병 프로필 2종 — InstitutionRiskProfile 구조)
  action_results.ts        (폭염 샘플 결과 — SAMPLE_AI_RESULT, role_based_actions 5역할)
  admin.ts                 (관리자 stats·plans 샘플)
  index.ts                 (전체 export, getSampleProfile, getSampleInfectionProfile 등)
  results/
    heatwave.ts            (향후 분리 예정 — 현재 action_results.ts 통합)
    heavyRain.ts           (집중호우 5역할 샘플 결과 + SAMPLE_HEAVY_RAIN_ACTION_REQUEST)
    infection.ts           (감염병 5역할 샘플 결과 + SAMPLE_INFECTION_ACTION_REQUEST)
```

---

## 3. Seed 데이터 구조 (`supabase/seed.sql`)

| 항목 | 폭염 | 집중호우 | 감염병 |
|---|---|---|---|
| 샘플 재난문자 | 3종 (기존 유지) | 1종 (호우경보) | 2종 (보건당국 안내) |
| `institution_risk_profiles` | heatwave 3건 (이관) | heavy_rain 1~2건 (저지대·지하공간) | infection 1건 (has_health_room=true) |
| `action_requests` + `result_json` | 기존 유지 | 5역할 샘플 결과 1건 | 5역할 샘플 결과 1건 (disaster_message_id=null) |
| `checklist_items` | 기존 유지 | 5역할 펼쳐 삽입 | 5역할 23건 (director 6, teacher 5, shuttle 2, cook 4, health 6) |

모든 seed는 멱등(`ON CONFLICT DO NOTHING` 또는 `IF NOT EXISTS`), 고정 UUID 사용.

---

## 4. 스모크 테스트 절차 및 구조 (`scripts/smoke-test.mjs`)

### 실행 방법

```bash
USE_SAMPLE_FALLBACK=true node scripts/smoke-test.mjs
# 서버가 http://localhost:3000 에서 실행 중이어야 한다.
```

### 테스트 항목 구성 (총 44개)

| 섹션 | 항목 수 | 내용 |
|---|---|---|
| S0 랜딩 | 1 | GET / 200 |
| S1/S2 기관 | 4 | GET institutions, new, /api/institutions, 프로필 |
| S3 재난문자 | 2 | GET /plan/new, /plan/new/message |
| S4 현재상황 | 1 | GET /plan/new/situation |
| S5 생성 API (경로 A 폭염) | 6 | POST generate(5역할·priority·disclaimer·400), GET 결과 페이지 2건 |
| S6 체크리스트 토글 | 1 | PATCH checklist |
| S7 사후기록 | 4 | GET/POST after-action, notes 2000자 초과 400 |
| S8/S9 관리자 | 4 | GET admin, stats, plans, plans?institution_id, 기관 상세 |
| P6 공공 API | 5 | geocode, weather, weather 400, disaster-sms, weather/impact |
| 경로 B (집중호우) | 6 | POST generate(5역할·disaster_type·disclaimer·source), disaster-sms?heavy_rain, GET 결과 페이지 |
| 경로 C (감염병) | 8 | POST generate(5역할·disaster_type·disclaimer·source·null msg_id), disaster-sms?infection, GET 결과 페이지 |
| PII/안전 점검 | 2 | 전화번호 패턴 없음·확진 단정 없음, PII 없이 정상 동작 |

### 경로 A 시연 흐름 (폭염)

```
wizardDraft = {
  disaster_type: 'heatwave' (기본값),
  disaster_message_text: '폭염경보 발효...',
  selected_situations: ['outdoor_play', 'heat_symptom_suspected']
}
```

### 경로 B 시연 흐름 (집중호우)

```
heavyRainDraft = {
  disaster_type: 'heavy_rain',
  disaster_message_text: '호우경보 발효. 저지대·지하공간 침수 위험...',
  selected_situations: ['pickup_prep', 'before_shuttle', 'basement_in_use']
}
```

### 경로 C 시연 흐름 (감염병 — 재난문자 없이)

```
infectionDraft = {
  disaster_type: 'infection',
  disaster_message_id: null,      ← 재난문자 없음
  disaster_message_text: '',      ← 비어도 400 발생 안 함
  selected_situations: ['fever_child', 'guardian_contact_needed', 'classroom_disinfection']
}
```

### 스모크 테스트 절차 (전체)

1. `USE_SAMPLE_FALLBACK=true`로 기동(외부 의존 전면 차단).
2. `node scripts/smoke-test.mjs` 실행 → 44/44 통과 확인.
3. 통과 시 `07_CONTEXT_LEDGER`의 "마지막 정상 시연" 갱신(날짜·포트·커밋).
4. (선택) ANTHROPIC_API_KEY 설정 + USE_SAMPLE_FALLBACK=false로 재기동해 실 AI 호출 경로 검증.
5. (선택) MOIS·KMA·Kakao API 키 설정 후 공공 API 실데이터 경로 검증.

---

## 5. Hooks 설계 (후보) — ⚠️ 이번 라운드 미적용, **P0 스캐폴딩 이후 사용자 승인 후 적용**

> 현재 `package.json`·prettier·tsc 미설치. 존재하지 않는 도구 호출 실패를 막기 위해 `.claude/settings.json`은 아직 만들지 않는다. 적용 시 각 hook은 **도구/설정 부재 시 조용히 스킵하는 가드**를 포함한다.

| 후보 | 트리거 | 동작 | 가드 | 차단성 |
|---|---|---|---|---|
| Prettier 포맷 | PostToolUse(Edit/Write, `*.ts/tsx/css/md`) | 변경 파일 prettier 적용 | prettier 설정/바이너리 존재 시에만 | 비차단 |
| Typecheck 안내 | PostToolUse(Edit/Write, `*.ts/tsx`) | `tsc --noEmit` 안내(또는 실행) | `tsconfig.json` 존재 시 | 비차단(알림) |
| AI 계약 검증 | PostToolUse(`lib/ai/**`, `lib/sample/aiResult.ts`, 프롬프트 파일) | 샘플 입출력 zod 검증 스크립트 | 스크립트 존재 시 | 비차단(경고) |
| Ledger 갱신 알림 | Stop(세션/작업 종료) | "07_CONTEXT_LEDGER 갱신했는가?" 리마인드 | 항상 | 비차단(알림) |

### 적용 시 설계 메모(승인 후)

- Windows/PowerShell 환경 → hook 커맨드는 크로스플랫폼 고려(node 스크립트 권장, 셸 분기 최소화).
- 포맷/타입체크는 **비차단**으로 운영(시연 중 작업 막힘 방지). 차단형은 도입하지 않음.
- 적용 절차: P0 완료 → `update-config` 스킬로 `.claude/settings.json`에 단계적 추가 → 1개씩 검증.

---

## 6. 관련 Skill / Subagent 매핑

- `api-fallback-check` ↔ §1 API 실패 시나리오 (3유형 × 공공 API fallback).
- `ai-json-contract` ↔ §1 JSON validation·유형별 AI 샘플 fallback.
- `demo-readiness` ↔ §4 스모크 테스트·모바일·3유형 시연 완주.
- `qa-demo-harness`(subagent) ↔ §4 실행 + "마지막 정상 시연" 기록.
- `privacy-safety-review` ↔ 샘플 데이터에 PII 미포함 점검(감염병 포함).
