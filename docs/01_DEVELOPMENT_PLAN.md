# 01_DEVELOPMENT_PLAN — 개발 계획

> 목표: 공모전 제출용 작동형 웹 MVP를 **시연 안정성 최우선**으로 완성한다.
> 기술 스택: Next.js(App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase PostgreSQL + Anthropic Claude API + Vercel 배포.
> 확정 결정: AI=**Anthropic Claude**, 인증=**시연용 역할 선택**, 공공 API=**가능한 많이 연동(전 기능 샘플 fallback 필수)**, 저장소=**Supabase 우선 + 샘플 fallback**.
> 최종 갱신: **2026-06-16** (P8~P11 완료 반영)

---

## 1. 개발 단계 (Phase)

| Phase | 내용 | 산출물 | 데모 가치 | 상태 |
|---|---|---|---|---|
| **P0 스캐폴딩** | Next.js+TS+Tailwind+shadcn 초기화, Supabase 연결, env, 공통 레이아웃, SafetyNotice 컴포넌트, fallback 토글 인프라 | 기동되는 빈 앱 | 기반 | **완료** |
| **P1 기관/프로필** | `institutions`·`heatwave_profiles` 마이그레이션, 시드, 기관등록 폼, 폭염 프로필 폼 | 기관 CRUD | 입력 | **완료** |
| **P2 재난문자/상황** | 샘플 재난문자 셋, 재난문자 입력(샘플/붙여넣기), 현재상황 선택(최대3) | 입력 단계 완성 | 입력 | **완료** |
| **P3 AI 생성(핵심)** | AI 입력 빌더(개인정보 제거), Claude Server Route, zod 스키마 검증, 1회 재시도, **샘플 fallback**, 결과 JSON 렌더 | 동작하는 AI 결과 | ★최중요 | **완료** |
| **P4 결과 활용** | 역할별 체크리스트 탭, 학부모 안내문(복사), 사후기록 폼·저장 | 결과 소비 완성 | 핵심 | **완료** |
| **P5 대시보드** | 관리자 대시보드(집계·목록·기관 상세) | 모니터링 | 차별화 | **완료** |
| **P6 공공 API(가산점)** | 주소·좌표 변환, 기상청 단기예보 우선 연동(+ 영향예보/재난문자/기관정보), 항상 fallback 동반 | 실데이터 연동 | 가산점 | **완료** |
| **P7 시연 폴리시·배포** | fallback 강제 점검, 시드 정비, 데모 스크립트, 반응형 마감, Vercel 배포 | 제출본 | 마감 | **완료** |
| **P8 공통화 리팩터링** | 폭염 하드코딩 제거, `lib/disaster/registry.ts`, `institution_risk_profiles` 마이그레이션(0002), `role_based_actions` AI 스키마 전환, 재난유형 선택 화면 | 확장 기반 | 확장 | **완료** |
| **P9 집중호우** | registry heavy_rain 등록, 집중호우 프로필 폼, AI policy block, 샘플 데이터, 시연 경로 B | 집중호우 시연 | 재난유형 확장 | **완료** |
| **P10 감염병** | registry infection 등록, 재난문자 옵션화, 감염병 프로필·샘플·seed, 시연 경로 C | 감염병 시연 | 재난유형 확장 | **완료** |
| **P11 역할 확장** | `cook_or_food_service`·`health_manager` 5역할 완성, `roleRecommendation.ts`, 관리자 역할 현황 | 5역할 시연 | 역할 확장 | **완료** |

> 원칙: **P0→P4까지가 데모 본선**. P3가 완료되면 핵심 가치가 증명된다. P6는 가산점. P8~P11은 재난유형·역할 확장으로 시연 완성도를 높인다.

---

## 2. 확장 단계 상세 (P8~P11)

### P8 — 공통화 리팩터링 (완료)
- **T8-1**: `lib/disaster/types.ts` + `registry.ts` 스캐폴딩 (RoleKey 5종, DisasterType 3종). `wizard.ts`에 `disaster_type` 추가.
- **T8-2**: `0002_disaster_expansion.sql` 마이그레이션 실행. `institution_risk_profiles` 신규 테이블(공통 컬럼 + `disaster_specific` JSONB). `institutions.staff_profile` 추가. `checklist_items.role` CHECK 5종 확장. `action_requests.risk_profile_id` 신규. `after_action_records.disaster_type/checked_items` 추가. `heatwave_profiles` → `institution_risk_profiles` 데이터 이관. 원격 DB 적용 완료.
- **T8-3**: AI 스키마 `role_based_actions` 배열 전환 + `legacyAdapter` + system prompt 분리(폭염 policy block). 샘플 결과 신규 구조 변환.
- **T8-4**: `SituationPicker` registry 참조. `PlanResult` 동적 역할 탭. `generate route` + `profile route`를 `institution_risk_profiles` 기반으로 전환. `profileMapping.ts` 어댑터.
- **T8-5**: 재난유형 선택 화면 `/plan/new/type` 신규. `WizardProgress` 4스텝으로 확장.

### P9 — 집중호우 (완료)
- registry `heavy_rain` enabled:true. `HEAVY_RAIN_POLICY_BLOCK` + output guidance. `ProfileForm` 집중호우 탭. `MessageInput` 유형별 샘플 메시지. `disasterSms.ts` `classifyDisasterType()` + 유형 필터. `lib/sample/results/heavyRain.ts` (5역할 샘플). smoke-test 경로 B 추가.

### P10 — 감염병 (완료)
- registry `infection` enabled:true. 재난문자 옵션화(감염병은 문자 없이 상황 입력만으로 AI 생성 가능). 감염병 금지 표현 강화(진단/확진 단정 금지). `lib/sample/infection_profiles.ts`. `supabase/seed.sql` 감염병 데이터. smoke-test 경로 C + PII 점검 추가 (총 44개). `lib/sample/results/infection.ts` (5역할 샘플).

### P11 — 역할 확장 (완료)
- `cook_or_food_service`·`health_manager` 역할 5종 완성. `PlanResult` role_based_actions 기반 5역할 탭. `roleRecommendation.ts` 순수함수. 관리자 대시보드 `DisasterTypeSummary` 3유형 건수 + 역할 지정 현황. 5역할 샘플 결과(폭염·집중호우·감염병 모두).

---

## 3. 작업 순서 (권장 시퀀스)

1. P0 스캐폴딩 → 앱 기동·레이아웃·SafetyNotice·env.
2. P1 DB 스키마 적용 + 시드 + 기관/프로필 폼.
3. P2 재난문자·상황 선택 입력.
4. **P3 AI 생성 라우트 + 검증 + fallback + 결과 렌더** (여기서 한 번 끝까지 흐름 연결).
5. P4 체크리스트/안내문/사후기록.
6. P5 대시보드.
7. P6 공공 API 연동(주소·좌표 → 단기예보 → 나머지).
8. P7 시연 폴리시·배포.
9. P8 공통화 리팩터링 (폭염 무중단 유지).
10. P9 집중호우 추가.
11. P10 감염병 추가.
12. P11 조리사·보건담당자 역할 완성.

> 권고: 각 P 단계 완료 후 **smoke-test(경로 A/B/C) 완주**로 회귀 여부를 즉시 확인한다.

---

## 4. 마일스톤

| 마일스톤 | 정의(Definition of Done) | 상태 |
|---|---|---|
| **M1 핵심 흐름 동작** | 역할선택→기관등록→프로필→재난문자→상황선택→AI생성(또는 fallback)→결과 표시까지 끊김 없이 완주 | **완료** |
| **M2 AI 안정화** | AI 출력이 JSON 스키마 100% 충족, 파싱 실패 시 자동 재시도→fallback. 개인정보 미전송 확인 | **완료** |
| **M3 결과 활용 + 대시보드** | 역할별 체크리스트/학부모 안내문(복사)/사후기록 저장 + 관리자 대시보드 동작 | **완료** |
| **M4 데모 준비완료** | 공공 API(최소 주소·좌표·단기예보) 연동 + 전면 fallback 검증 + Vercel 배포 + 데모 스크립트 완성 | **완료** |
| **M5 3유형·5역할 확장** | 폭염·집중호우·감염병 3유형 × 원장·담임·통학버스·조리·보건 5역할 시연 경로 A/B/C 전 완주. smoke-test 44/44 PASS. | **완료** |

---

## 5. 예상 리스크 및 완화책

| 리스크 | 영향 | 완화책 | 상태 |
|---|---|---|---|
| **AI JSON 파싱 실패** | 결과 화면 깨짐 | zod 스키마 강제 + JSON-only 프롬프트 + 1회 재시도 + 유형별 샘플 fallback | 완화 완료 |
| **공공 API 불안정/인증키 발급 지연** | 연동 미완 | API는 가산점으로 분리, 전부 Server Route + 샘플 응답 fallback. 키 미발급 시 자동 샘플 모드 | 완화 완료 |
| **Supabase RLS/네트워크 시연 충돌** | 저장·조회 실패 | service-role은 서버 라우트에서만, DB 실패 시 in-memory 샘플 시드로 표시 | 완화 완료 |
| **시연장 네트워크 불안정** | 데모 중단 | `USE_SAMPLE_FALLBACK=true` 강제 토글로 오프라인 데모 모드 운영, 사전 시드 | 완화 완료 |
| **AI 응답 지연** | 체감 저하 | 로딩 UI + 타임아웃 후 fallback, 모델 기본 `claude-haiku-4-5` | 완화 완료 |
| **개인정보 유입 위험** | 원칙 위반 | 스키마에 PII 컬럼 부재 + AI 입력 빌더에서 화이트리스트 필드만 직렬화 + 자유텍스트 경고 | 완화 완료 |
| **감염병 표현 위험(진단·낙인)** | 안전 원칙 위반 | 감염병 policy block에 금지 표현 목록 명시. `/privacy-safety-review` 검증 | 완화 완료 |
| **역할 배치 법적 단정** | 법적 리스크 | `roleRecommendation.ts`에서 "확인이 필요합니다" 톤만 사용. 단정 표현 금지 | 완화 완료 |

---

## 6. 시연 준비 계획

### 시연 경로 3종 (harness 고정)

| 경로 | 재난유형 | 대표 상황 | 시연 포인트 |
|---|---|---|---|
| **경로 A** (폭염) | heatwave | 실외놀이 전 + 온열증상 의심 | 5역할 체크리스트, 학부모 안내문 복사 |
| **경로 B** (집중호우) | heavy_rain | 하원 준비 + 통학버스 운행 전 + 지하공간 사용 중 | 5역할 행동, 대피 관련 조리·보건 탭 |
| **경로 C** (감염병) | infection | 발열 유아 있음 (재난문자 없이) | 보건·조리 체크리스트 + 학부모 안내문 + 등원중지 안내 |

### 시드 데이터
- 기관 3~5곳(어린이집·유치원 혼합), `institution_risk_profiles` 3유형 각 1~2건, 샘플 재난문자 3유형 × 3종, 데모용 대응계획 3건(유형별 1건씩).

### fallback 강제 토글
- `USE_SAMPLE_FALLBACK=true`로 외부 의존 전면 차단해도 동일 데모 가능함을 smoke-test(44개)로 검증 완료.

### 리허설
- 제출 전 경로 A/B/C 각각 2회 완주 리허설. smoke-test 44/44 통과 확인.

---

## 7. 산출물 추적
- 본 문서의 Phase/마일스톤은 `06_TASK_BREAKDOWN.md`의 태스크 단위와 1:1로 연결된다.
- P8~P11 상세 태스크 체크리스트: `docs/11_DISASTER_TYPE_EXPANSION_PLAN.md` §12.
