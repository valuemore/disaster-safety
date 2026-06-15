---
name: mvp-slice
description: 재난안전MVP에서 작은 기능 1슬라이스를 구현할 때 사용. 새 화면/route/기능 구현 시작 시 호출. docs 선독 → 구현 → typecheck/build/스모크 → Context Ledger 갱신까지의 표준 절차.
---

# mvp-slice — 작은 단위 기능 구현 절차

작동하는 최소 단위(슬라이스)로 구현하고 항상 시연 흐름을 유지한다.

## 언제 호출
- 새 기능/화면/route를 시작할 때. P0–P7 태스크(`docs/06_TASK_BREAKDOWN.md`) 1개 단위.

## 절차
1. **docs 선독(필수)**: 관련 문서를 먼저 읽는다 — 해당 기능 영역(`docs/02` DB, `docs/03` API, `docs/04` AI, `docs/05` UI) + `docs/06` 태스크의 DoD.
2. **범위 확정**: 1슬라이스 = 동작하는 작은 단위. 완료조건(DoD)을 1줄로 적는다.
3. **구현**: 코딩 스타일(CLAUDE.md) 준수 — TS strict, 외부호출/비밀키는 서버 Route, 모바일 우선.
4. **안전 점검**: 개인정보/AI 표현 영향 시 `/privacy-safety-review`, AI 계약 변경 시 `/ai-json-contract`, API 연동 시 `/api-fallback-check` 동반.
5. **검증**: typecheck(`tsc --noEmit`) → build → 영향 흐름 스모크(가능하면 S0→S7 일부). 실패 시 수정.
6. **Ledger 갱신**: `docs/07_CONTEXT_LEDGER.md`의 완료/진행/다음 작업/샘플·API 상태와 "다음 세션 시작 프롬프트" 갱신.
7. **결정 기록**: 의사결정 발생 시 `docs/08_DECISION_LOG.md`에 append(절대날짜).

## 체크리스트
- [ ] 관련 docs를 읽었다
- [ ] DoD 1줄 정의
- [ ] 외부호출/비밀키는 서버 Route에만
- [ ] 샘플 fallback 경로 유지(시연 무중단)
- [ ] typecheck/build 통과
- [ ] 영향 흐름 스모크 확인
- [ ] Context Ledger 갱신
