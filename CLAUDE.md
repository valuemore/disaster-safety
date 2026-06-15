@AGENTS.md

# CLAUDE.md — 재난안전MVP

> 항상 로드되는 핵심 원칙만 담는다. 상세 절차는 `docs/`와 `.claude/skills/`로 위임한다.

## 프로젝트 목적
지자체 **폭염** 재난문자를 유아교육기관 운영상황에 맞춰 **원장·담임교사·통학버스 담당자별 체크리스트 / 학부모 안내문 / 사후기록**으로 변환하는 AI 기반 웹 MVP. 공모전(제품·서비스 개발 부문) 제출용 **작동형 시제품**.

## MVP 범위
- 1차 재난유형은 **폭염만**. 그 외(호우·대설·화재·감염병·미세먼지)는 확장 문서로만. 제외 범위는 `docs/00_PRD.md` §7.

## 구현 우선순위
- **P0–P4가 데모 본선**(스캐폴딩→기관/프로필→재난문자/상황→AI생성→결과활용). P5 대시보드, P6 공공API(가산점), P7 배포.
- 상세: `docs/01_DEVELOPMENT_PLAN.md`, 태스크: `docs/06_TASK_BREAKDOWN.md`.

## 개인정보 금지 원칙 (필수)
- 유아 **이름·진단명·약물명·보호자 연락처 저장 금지**. 스키마에 해당 컬럼을 두지 않는다.
- 취약 유아 정보는 **숫자 집계값만** 저장.
- **AI API에 개인식별정보(PII)를 전송하지 않는다**(화이트리스트 필드만 직렬화).

## AI 출력 안전 원칙
- AI 응답은 **JSON으로만** 받는다. 파싱 실패 시 **1회 재시도 → 샘플 결과 fallback**(`docs/04_AI_PROMPT_SPEC.md`).
- AI는 **의료 진단을 하지 않는다**. **공식기관 지시보다 우선한다고 표현하지 않는다**.
- "AI가 위험을 예측했다"가 아니라 **"공식 재난문자와 기관 입력정보를 바탕으로 대응 우선순위를 제안한다"** 로 표현.
- 결과/안내 화면에 고정 안전 문구 노출: *"공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다."*

## 샘플 데이터 fallback 원칙
- AI/공공 API/DB가 실패해도 **샘플 데이터로 시연이 멈추지 않아야** 한다.
- `USE_SAMPLE_FALLBACK=true`로 외부 의존을 전면 차단해도 전 흐름이 동작해야 한다.

## 코딩 스타일
- TypeScript strict. Next.js(App Router) + Tailwind + shadcn/ui. **모바일 웹 우선**.
- **외부 호출·비밀키는 서버(Route)에서만**. `service_role`·API 키는 클라이언트 노출 금지.
- 작은 단위로 구현하고 항상 동작 상태를 유지한다.

## 커밋 / 작업 단위 원칙
- **작은 슬라이스 = 동작하는 단위**로 커밋. 한 커밋이 시연 흐름을 깨지 않게.
- 큰 변경 전후로 스모크 테스트(S0→S7 완주)를 우선한다.

## 작업 규칙
- **구현 전 반드시 관련 `docs/`를 먼저 읽는다.**
- **큰 작업을 마칠 때마다 `docs/07_CONTEXT_LEDGER.md`를 갱신**하고 "다음 세션 시작 프롬프트"를 최신화한다.
- 반복 절차는 Skill로 수행: `/mvp-slice`, `/ai-json-contract`, `/privacy-safety-review`, `/demo-readiness`, `/api-fallback-check`.
- 의사결정이 생기면 `docs/08_DECISION_LOG.md`에 추가(절대날짜).

## 문서 인덱스
`docs/00_PRD` · `01_DEVELOPMENT_PLAN` · `02_DB_SCHEMA` · `03_API_INTEGRATION_PLAN` · `04_AI_PROMPT_SPEC` · `05_UI_FLOW` · `06_TASK_BREAKDOWN` · `07_CONTEXT_LEDGER` · `08_DECISION_LOG` · `09_DEMO_SCRIPT` · `10_HARNESS_PLAN`
