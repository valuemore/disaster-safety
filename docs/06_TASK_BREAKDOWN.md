# 06_TASK_BREAKDOWN — 태스크 분해

> 각 태스크: **설명 / 완료조건(DoD) / 의존성**. ID는 Phase(01 문서)와 정렬.
> 우선순위 표기: ★핵심(데모 본선, P0–P4) / ◆가산점·후순위(P5–P6) / ◇마감(P7) / ◈확장(P8–P11).

---

## Phase 0 — 스캐폴딩 (★)

| ID | 태스크 | 완료조건(DoD) | 의존성 |
|---|---|---|---|
| T-001 | 프로젝트 초기화(Next.js+TS+Tailwind+shadcn) | `dev` 서버 기동, 기본 레이아웃 렌더 | — |
| T-002 | Supabase 프로젝트 연결 + 클라이언트 유틸 | 서버/클라 Supabase 클라이언트 분리(`anon`/`service_role`) | T-001 |
| T-003 | 환경변수 세팅(03 문서) + 키 부재 시 샘플 모드 분기 | 키 없어도 빌드·기동, `USE_SAMPLE_FALLBACK` 토글 동작 | T-001 |
| T-004 | 공통 컴포넌트: `SafetyNotice`, `FallbackBadge`, 레이아웃/네비 | 결과 화면 고정 문구 노출 컴포넌트 완성 | T-001 |

## Phase 1 — 기관/프로필 (★)

| ID | 태스크 | DoD | 의존성 |
|---|---|---|---|
| T-010 | DB 마이그레이션: 6개 테이블(02 문서) + CHECK + 인덱스 | Supabase에 스키마 적용, RLS enable | T-002 |
| T-011 | 시드 데이터(기관 3~5, 프로필, 샘플 재난문자 3, 데모 결과) | 시드 실행 시 데이터 조회 가능 | T-010 |
| T-012 | `RoleSelector`(S0) | 4개 역할 선택→역할 상태 저장, 전환 가능 | T-004 |
| T-013 | `InstitutionForm`(S1) 등록/저장 | 기관 정보 전 필드 입력·저장, 서버 라우트 INSERT | T-010 |
| T-014 | `ProfileForm`(S2) 등록/저장 | 집계값·토글 저장, **PII 필드 부재 확인** | T-010 |

## Phase 2 — 재난문자/상황 (★)

| ID | 태스크 | DoD | 의존성 |
|---|---|---|---|
| T-020 | 샘플 재난문자 셋 정의(04와 일치) | 강도별 3종 선택 가능 | T-011 |
| T-021 | `MessageInput`(S3): 샘플 선택/원문 붙여넣기 | 선택·입력값이 생성 입력으로 전달 | T-020 |
| T-022 | `SituationPicker`(S4): 버튼형, **최대 3개**, 기타 입력 | 4개 이상 선택 차단, 기타 텍스트 캡처 | T-004 |

## Phase 3 — AI 생성 (★ 최중요)

| ID | 태스크 | DoD | 의존성 |
|---|---|---|---|
| T-030 | AI 입력 빌더(화이트리스트 필드만 직렬화) | 출력 객체에 PII 0건(단위 검증) | T-013,T-014,T-021,T-022 |
| T-031 | zod 출력 스키마 정의(04 문서) | 스키마로 유효/무효 케이스 통과 | T-001 |
| T-032 | Claude Server Route(`/api/plan/generate`) | 정상 호출 시 JSON 반환·저장(`action_requests`) | T-030,T-031,T-003 |
| T-033 | 파싱 실패 처리: 추출→검증→1회 재시도→**샘플 fallback** | 강제 오류 주입 시 fallback 결과로 S5 렌더, `is_fallback=true` | T-032 |
| T-034 | `safety_disclaimer` 고정 주입 + 타임아웃 처리 | 모든 경로에서 고정 문구 보장, 타임아웃 시 fallback | T-033 |
| T-035 | `PlanResult`(S5) 렌더: 요약·우선순위·근거·부족정보·역할 탭 | 샘플/실결과 모두 정상 렌더 | T-032,T-004 |
| T-036 | `checklist_items` 펼침 저장 | 역할별 항목 INSERT, 체크 토글 동작 | T-035 |

> **스모크 테스트(권장 게이트)**: T-036 완료 후 S0→S7 1회 완주(외부 의존 차단 모드 포함).

## Phase 4 — 결과 활용 (★)

| ID | 태스크 | DoD | 의존성 |
|---|---|---|---|
| T-040 | `ChecklistCard` 체크 토글·진행률 | 항목 완료 저장·표시 | T-036 |
| T-041 | `ParentNoticeCard`(S6) + 복사 버튼 | 클립보드 복사·완료 토스트 | T-035 |
| T-042 | `AfterActionForm`(S7) AI 초안 자동 채움 + 저장 | 사후기록 저장(`after_action_records`) | T-035 |

## Phase 5 — 관리자 대시보드 (◆)

| ID | 태스크 | DoD | 의존성 |
|---|---|---|---|
| T-050 | `AdminDashboard`(S8) 집계 | 등록 기관 수/오늘 생성 수/우선순위 高 기관 수 표시 | T-032 |
| T-051 | 기관별 최근 대응계획 목록 + 기관 상세(S9) | 목록·상세 조회·결과 열람 | T-050 |

## Phase 6 — 공공 API 연동 (◆ 가산점, 항상 fallback 동반)

| ID | 태스크 | DoD | 의존성 |
|---|---|---|---|
| T-060 | 주소·좌표 변환 Route + 폼 연동 | 주소→좌표 자동(Kakao), 실패 시 수기 유지 | T-013 |
| T-061 | 기상청 단기/초단기예보 Route + `weather_context` 주입 | 실데이터/샘플 분기, AI 근거 반영 | T-032 |
| T-062 | 기상청 폭염영향예보 + 행안부 재난문자 Route | 실데이터 옵션 + 샘플 fallback, `source` 메타 | T-061,T-021 |
| T-063 | (선택) 어린이집/유치원 정보 API | 자동 입력 옵션, 미발급 시 스킵 | T-013 |

## Phase 7 — 시연 폴리시·배포 (◇)

| ID | 태스크 | DoD | 의존성 |
|---|---|---|---|
| T-070 | fallback 전면 점검(`USE_SAMPLE_FALLBACK=true`) | 외부 의존 차단 상태로 전 흐름 완주 | T-036,T-042 |
| T-071 | 반응형·모바일 마감 + 로딩/에러 상태 | 모바일 폭에서 전 화면 정상, `/plan/[id]/loading.tsx` | Phase 4 |
| T-072 | 데모 시나리오 스크립트 + 리허설 | 데모 2회 완주 | T-070 |
| T-073 | Vercel 배포 + 환경변수 설정 | 배포 URL에서 데모 동작, `vercel.json` maxDuration 설정 | T-070 |

---

## Phase 8 — 공통화 리팩터링 (◈ 확장)

| ID | 태스크 | DoD | 의존성 | 상태 |
|---|---|---|---|---|
| T8-1 | `lib/disaster/types.ts` + `registry.ts` 스캐폴딩. `wizard.ts`에 `disaster_type` 추가(기본값 heatwave). | DisasterType·RoleKey·DISASTER_REGISTRY(폭염 등록). WizardDraft.disaster_type 동작. tsc + build 통과. | T-031 | ✅ 완료 |
| T8-2 | `0002_disaster_expansion.sql` 마이그레이션 + 타입 동기화. heatwave 데이터 이관. | institution_risk_profiles·staff_profile·checked_items·role CHECK 5종. 원격 DB 적용 완료. 폭염 시연 흐름 무중단. | T-010 | ✅ 완료 |
| T8-3 | AI 스키마 `role_based_actions` 배열로 전환 + `legacyAdapter` 추가 + system prompt 분리(폭염 policy block). | aiPlanSchema.ts, systemPrompt.ts, buildSystemPrompt.ts, legacyAdapter.ts, disaster/heatwave.ts. tsc + build 통과. | T8-1 | ✅ 완료 |
| T8-4 | buildAiInput / generate route / PlanResult / SituationPicker를 registry·role_based_actions 기반으로 전환. | 폭염 경로 그대로 동작. ProfileForm 재난유형 분기. institution_risk_profiles 실 DB 사용. | T8-3 | ✅ 완료 |
| T8-5 | 재난유형 선택 화면 `/plan/new/type` 추가. 마법사 흐름 4단계로 확장. | 폭염 선택 → 정상 흐름. WizardProgress 4단계 업데이트. 24개 라우트 build 통과. | T8-4 | ✅ 완료 |

## Phase 9 — 집중호우 (◈ 확장)

| ID | 태스크 | DoD | 의존성 | 상태 |
|---|---|---|---|---|
| T9-1 | registry에 `heavy_rain` 등록 + policy block + output guidance. | DISASTER_REGISTRY heavy_rain enabled:true. disaster/heavyRain.ts. buildSystemPrompt 연결. | T8-3 | ✅ 완료 |
| T9-2 | 집중호우 프로필 폼/입력화면 유형 분기. `disasterSms.ts` classifyDisasterType + 유형 파라미터. | HeavyRainProfileForm, heavyRainFormToRiskProfile, classifyDisasterType(), fetchRecentDisasterSms(sido, disasterType?). 폭염 무중단. | T8-4 | ✅ 완료 |
| T9-3 | 샘플 메시지·프로필·결과(5역할) + seed. 시연 경로 B harness. | SAMPLE_HEAVY_RAIN_AI_RESULT(5역할), SAMPLE_HEAVY_RAIN_PROFILES. seed.sql 집중호우 데이터. smoke-test 경로 B(6개) 추가. 36/36 통과. | T9-2 | ✅ 완료 |

## Phase 10 — 감염병 (◈ 확장)

| ID | 태스크 | DoD | 의존성 | 상태 |
|---|---|---|---|---|
| T10-1 | registry에 `infection` 등록. 감염병 policy block + output guidance. 재난문자 옵션화. | DISASTER_REGISTRY infection 등록. disaster/infection.ts. disaster_message_text 빈 값 허용(감염병 2-모드). | T8-3 | ✅ 완료 |
| T10-2 | 감염병 금지 표현 강화(진단/확진 금지·보건당국 우선·익명·낙인 금지). | INFECTION_POLICY_BLOCK 안전규칙 반영. /privacy-safety-review 검증. | T10-1 | ✅ 완료 |
| T10-3 | 샘플·seed·시연 경로 C harness. infection enabled:true 전환. | SAMPLE_INFECTION_AI_RESULT(5역할), SAMPLE_INFECTION_PROFILES. seed.sql 감염병 데이터(메시지 2건·프로필 1건·checklist 23건). smoke-test 경로 C(8개)+PII 점검(2개) = 총 44개. 44/44 통과. | T10-2 | ✅ 완료 |

## Phase 11 — 역할 확장(조리사·보건담당자) (◈ 확장)

| ID | 태스크 | DoD | 의존성 | 상태 |
|---|---|---|---|---|
| T11-1 | RoleKey에 `cook_or_food_service`·`health_manager` 추가. checklist_items role CHECK 5종 확장(0002에 포함). 역할 라벨·탭 동적화. | ROLEKEY_TO_DB_ROLE 5역할. ROLE_LABELS 5역할. PlanResult role_based_actions 기반 5역할 동적 탭. ChecklistCard cook/health 정상 렌더. | T8-2 | ✅ 완료 |
| T11-2 | registry 각 유형 policy block에 두 역할 출력 가이드 추가. 샘플 결과 5역할 완성. | heatwave/heavyRain/infection.ts 5역할 actions 포함. SAMPLE_*_AI_RESULT 5역할 확인. | T11-1 | ✅ 완료 |
| T11-3 | `roleRecommendation.ts` + 프로필 폼 급식·보건 인력 입력 + 추천 문구(법적 단정 금지). | getRoleRecommendations 순수함수. "배치 기준 확인이 필요합니다" 톤. 어린이집 40명+/100명+, 유치원 36학급+ 기준. | T11-2 | ✅ 완료 |
| T11-4 | 관리자 대시보드 재난유형별·역할 지정 현황 추가. 3개 시연 경로 전체 5역할 완주. /demo-readiness 최종. | DisasterTypeSummary 3유형 뱃지·막대. smoke-test 44/44. 최종 종합 QA(2026-06-16) 통과. | T11-3 | ✅ 완료 |

---

## 의존성 그래프(요약)

```
T-001 ─┬─ T-002 ─ T-010 ─┬─ T-011 ─ T-020 ─ T-021 ┐
       │                  ├─ T-013 ─────────────────┤
       │                  └─ T-014 ─────────────────┤
       ├─ T-003                                      │
       ├─ T-004 ─ T-012, T-022 ──────────────────────┤
       └─ T-031                                      │
                                                     ▼
                        T-030 ─ T-032 ─ T-033 ─ T-034 ─ T-035 ─ T-036
                                  │                         │
                          (가산점) T-061/062            T-040/041/042
                                                            │
                                  T-050 ─ T-051        T-070 ─ T-071 ─ T-072 ─ T-073
                                                                │
                                        T8-1~T8-5 ─ T9-1~T9-3 ─ T10-1~T10-3 ─ T11-1~T11-4
```

## 작업 순서 한 줄 요약

P0(T-001~004) → P1(T-010~014) → P2(T-020~022) → **P3(T-030~036) + 스모크 테스트** → P4(T-040~042) → P5(T-050~051) → P6(T-060~063, 가산점) → P7(T-070~073, 마감/배포) → **P8(공통화 리팩터링) → P9(집중호우) → P10(감염병) → P11(조리사·보건담당자 역할)**.

## 현재 완료 상태 (2026-06-16 기준)

- **P0~P11 전 태스크 완료**.
- 스모크 테스트 **44/44 통과** (USE_SAMPLE_FALLBACK=true, 경로 A+B+C, 2026-06-16).
- tsc --noEmit 오류 0건. npm run build 24개 라우트 정상.
- 배포 URL: https://disastersafety.vercel.app

## 후순위·확장(문서로만)

- 추가 재난유형(대설/화재/미세먼지): `00_PRD` §7 유지.
- 침수위험지도·하천정보·대피소 공공 API 연동.
- 감염병 공공데이터·보건소 자료·기관 매뉴얼 업로드 자동 연계.
- Supabase Auth 기반 실제 권한체계, 알림톡/재난문자 자동수신, 이미지/영상 분석, IoT.
