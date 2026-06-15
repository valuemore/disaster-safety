# 10_HARNESS_PLAN — 하네스(Harness) 및 Hooks 설계

> 공모전 MVP는 **시연 안정성**이 핵심. 본 문서는 시연을 떠받치는 하네스(샘플 데이터·검증·스모크 테스트)와 자동화 hooks 설계를 정의한다.
> 업데이트 시점: harness/hooks 변경 시. 실제 fixture/스크립트 코드는 P0–P3에서 구현(여기는 설계·완료조건).

---

## 1. Harness 구성 요소 · 구현 위치 · 완료조건

| 구성 | 내용 | 구현 위치(예시) | 구현 Phase | 완료조건(DoD) |
|---|---|---|---|---|
| 샘플 기관 데이터 | 3~5곳(어린이집/유치원, 통학버스 유무 혼합) — `docs/02` 시드와 일치 | `lib/sample/institutions.ts` / `supabase/seed.sql` | P1 | DB·in-memory 양쪽에서 동일 조회 |
| 샘플 폭염 재난문자 | 주의보/경보/야외자제 3종 — `docs/04`와 일치 | `lib/sample/messages.ts` | P2 | S3에서 선택 가능 |
| 샘플 현재상황 조합 | 대표 3세트(실외놀이중+온열의심 / 통학버스 탑승전 / 특별일정없음) | `lib/sample/situations.ts` | P2 | S4 프리셋 |
| AI 샘플 응답 fallback | `docs/04` §6.2 샘플 출력 재사용 | `lib/sample/aiResult.ts` | P3 | 파싱 실패/오프라인 시 동일 결과 렌더 |
| JSON schema validation | zod 스키마(`docs/04` §2) | `lib/ai/schema.ts` | P3 | 유효/무효 케이스 테스트 통과 |
| 3분 시연 smoke test | S0→S7 1회 완주 | `scripts/smoke.md`(수동) + 가능 시 e2e | P3 | 완주 체크 통과 |
| API 실패 시나리오 테스트 | `USE_SAMPLE_FALLBACK=true` / 키 제거 | `scripts/fallback-check.md` | P6(설계 P3) | 전 흐름 동작 |
| 모바일 화면 기본 확인 | 세로 단일 컬럼·터치 타깃·복사 버튼 | 수동 체크리스트 | P4/P7 | 모바일 폭 정상 |
| "마지막 정상 시연" 기록 | 날짜·경로·커밋 | `docs/07_CONTEXT_LEDGER.md` | P3+ | 갱신 운영 |

### 설계 원칙
- 샘플 데이터는 **단일 출처(single source)**: `lib/sample/*`가 DB 시드와 in-memory fallback의 공통 원본. `docs/02`·`docs/04` 값과 항상 일치.
- 모든 fallback 경로는 결과에 `source: 'sample' | 'api' | 'db'`, `is_fallback` 메타를 남겨 UI 배지로 투명하게 표시.

---

## 2. 스모크 테스트 절차(수동 기준)
1. `USE_SAMPLE_FALLBACK=true`로 기동(외부 의존 전면 차단).
2. S0 역할선택 → S1/S2 → S3(샘플 문자) → S4(상황 최대3) → S5 생성 → 역할 탭 → S6 복사 → S7 저장 완주.
3. 키 설정 + fallback=false로 재기동해 동일 완주(실데이터/AI 경로).
4. 통과 시 `07_CONTEXT_LEDGER`의 "마지막 정상 시연" 갱신(날짜·경로·커밋).

---

## 3. Hooks 설계 (후보) — ⚠️ 이번 라운드 미적용, **P0 스캐폴딩 이후 사용자 승인 후 적용**

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

## 4. 관련 Skill / Subagent 매핑
- `api-fallback-check` ↔ §1 API 실패 시나리오.
- `ai-json-contract` ↔ §1 JSON validation·AI 샘플 fallback.
- `demo-readiness` ↔ §2 스모크 테스트·모바일.
- `qa-demo-harness`(subagent) ↔ §2 실행 + "마지막 정상 시연" 기록.
- `privacy-safety-review` ↔ 샘플 데이터에 PII 미포함 점검.
