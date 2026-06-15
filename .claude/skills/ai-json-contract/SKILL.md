---
name: ai-json-contract
description: AI 입력/출력 JSON 계약을 점검할 때 사용. AI 호출 코드, 시스템 프롬프트, zod 스키마, 샘플 결과를 추가/변경할 때 호출. 입력 화이트리스트(PII 0)·출력 스키마 일치·파싱 실패 재시도·샘플 fallback을 검증한다.
---

# ai-json-contract — AI JSON 계약 점검

기준 문서: `docs/04_AI_PROMPT_SPEC.md`.

## 언제 호출
- `lib/ai/**`, 시스템 프롬프트, 출력 zod 스키마, AI 샘플 결과(`lib/sample/aiResult.ts`)를 추가/변경할 때.

## 입력(서버가 구성) 점검
- [ ] 입력 JSON에 **화이트리스트 필드만** 직렬화 — 이름/진단명/약물명/연락처 등 PII **0건**.
- [ ] 취약 유아 정보는 숫자 집계값만.
- [ ] `selected_situations` 최대 3개 코드값.

## 출력 점검
- [ ] `docs/04` §2 스키마 11개 항목 모두 존재(요약·우선순위·근거·부족정보·원장/담임/통학버스 체크리스트·학부모 안내문·사후기록 초안·응급연락·공식기관 우선 안내·safety_disclaimer).
- [ ] zod 스키마로 검증(배열 필드 최소 1개). 무효 케이스 테스트 통과.
- [ ] `safety_disclaimer`는 서버에서 고정 문구로 보장(덮어쓰기).
- [ ] 통학버스 미운영 기관은 `shuttle_checklist` "해당 없음" 처리.

## 실패/안정성 점검
- [ ] JSON 파싱: 텍스트 추출 → zod 검증 → **1회 재시도** → 실패 시 **샘플 fallback**(`is_fallback=true`).
- [ ] 타임아웃 시 즉시 fallback.
- [ ] 모든 경로에서 결과 화면 정상 렌더(데모 무중단).

## 표현 점검(→ /privacy-safety-review 와 연동)
- [ ] 의료 진단/약물 권고/공포 표현/공식기관 우선권 침해 표현 없음.
- [ ] "위험 예측" 단정 대신 "대응 우선순위 제안" 표현.
