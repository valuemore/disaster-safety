# 11_DISASTER_TYPE_EXPANSION_PLAN — 재난유형·역할 확장 계획

> 본 문서는 재난유형(3종)·역할(5종) 확장 작업의 **단일 진실 소스(SSOT)**.
> 작성일: **2026-06-15** / 근거: `C:\Users\sky\.claude\plans\claude-code-tender-prism.md` (사용자 확인 완료)
> 구현 착수 전 반드시 본 문서와 `docs/00_PRD`, `docs/01_DEVELOPMENT_PLAN`, `docs/02_DB_SCHEMA`, `docs/04_AI_PROMPT_SPEC`을 함께 참조한다.

---

## 1. 목적 및 범위

### 1.1 목적
현재 폭염(heatwave) 전용으로 하드코딩된 MVP 구조를 **공통 구조 + 재난유형별 레지스트리**로 리팩터링하고, 재난유형 3종·역할 5종을 지원하는 확장 기반을 마련한다.

### 1.2 확장 범위
- **재난유형 3종**: 폭염(heatwave) · 집중호우(heavy_rain) · 감염병(infection)
- **역할 5종**: 원장(director) · 담임교사(homeroom_teacher) · 통학버스담당자(bus_manager) · 조리사/급식담당자(cook_or_food_service) · 보건담당자(health_manager)
- 기존 역할 키(`teacher`, `shuttle`)는 DB 저장 레이어에서 매핑 변환하여 하위 호환 유지

### 1.3 제외 범위 (2차 이후)
- 침수위험지도 / 하천정보 / 대피소 공공 API 연동
- 감염병 공공데이터·보건소 자료·기관 매뉴얼 업로드 자동 연계
- 대설·화재·미세먼지 재난유형 (`docs/00_PRD` §7 유지)

---

## 2. 설계 원칙

1. **공통 출력 스키마 단일화** — 모든 재난유형이 동일한 JSON 골격(`role_based_actions` 배열)을 공유. 내용만 유형별로 달라진다.
2. **유형별 차이는 데이터(레지스트리)로 표현** — policy block·상황 버튼·프로필 필드를 코드 분기 없이 `lib/disaster/registry.ts` 설정 객체로 정의.
3. **사후기록 공통화** — 폭염 전용 boolean 5개를 `checked_items JSONB`(유형별 항목 키-값)로 일반화.
4. **PII 0건 유지** — 감염병에서도 이름·진단명·연락처 컬럼 없음. "발열 유아 1명" 등 집계·익명 상황값만. AI 입력 화이트리스트 유지.
5. **감염병은 재난문자 없이도 동작** — `disaster_message_text` 옵션화. 기관 내 유증상 상황 입력만으로 AI 생성 가능.
6. **폭염 기능 무중단** — 각 P 단계 완료 후 폭염 시연 경로(S0→S7)가 반드시 통과해야 한다.
7. **샘플 fallback 항상 동작** — `USE_SAMPLE_FALLBACK=true`로 외부 의존 전면 차단 시에도 3개 유형 전 흐름이 완주되어야 한다.

---

## 3. 확정된 설계 결정

> 아래 3가지는 2026-06-15 사용자 확인 완료. 번복 시 `docs/08_DECISION_LOG.md`에 절대날짜로 기록.

| # | 결정 항목 | 결정 내용 |
|---|---|---|
| D-A | DB 구조 | **선택지 C** — 공통 컬럼 + `disaster_specific` JSONB. 신규 `institution_risk_profiles` 범용 테이블. 기존 `heatwave_profiles`는 호환 뷰로 유지 후 안정화 시 제거 검토. |
| D-B | AI 출력 구조 | **`role_based_actions[]` 동적 배열** + 기존 `director/teacher/shuttle_checklist`는 `lib/ai/legacyAdapter.ts`의 파생 getter로 유지(하위 호환). |
| D-C | 구현 순서 | **P8 공통화 리팩터링(폭염 유지) → P9 집중호우 → P10 감염병 → P11 조리사+보건담당자 역할 추가** |

---

## 4. DB 마이그레이션 전략

### 4.1 마이그레이션 파일
`supabase/migrations/0002_disaster_expansion.sql` 신규 작성 (기존 `0001_initial.sql` 데이터 보존)

### 4.2 마이그레이션 단계 요약

**(a) 재난유형 enum 제약 추가**
```sql
alter table disaster_messages
  add constraint chk_disaster_type
  check (disaster_type in ('heatwave','heavy_rain','infection'));
```

**(b) 범용 프로필 테이블 신규 생성**
```sql
create table institution_risk_profiles (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  disaster_type   text not null check (disaster_type in ('heatwave','heavy_rain','infection')),
  -- 공통 위험대응 컬럼 (모든 유형 공유)
  thermometer        boolean not null default false,
  first_aid_kit      boolean not null default false,
  indoor_alt_space   boolean not null default false,
  -- 유형별 특수 필드 (JSONB)
  disaster_specific  jsonb not null default '{}'::jsonb,
  is_current      boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (institution_id, disaster_type, is_current)
);
```
- 폭염 특수필드: `heat_vulnerable_count`, `cooling_ok`, `water_supply_ok`, `vehicle_thermometer`, `pickup_wait_place` 등 → `disaster_specific` JSONB
- 집중호우 특수필드: 저지대 여부, 인근 하천/배수로/급경사지, 지하공간, 1층 출입구 구조, 대피 가능 공간 등 → JSONB
- 감염병 특수필드: 반별 유아수, 영아반, 보건실/분리대기 공간, 체온계, 소독용품, 보호자 연락 방식 등 → JSONB

**(c) 기관 staff 프로필 컬럼 추가** (역할 자동활성화용)
```sql
-- institutions 테이블에 단일 JSONB 컬럼 추가
alter table institutions add column staff_profile jsonb default '{}'::jsonb;
-- 포함 키: meal_count_per_serving, has_food_service_staff, food_service_staff_count,
--         has_cook_license_staff, has_collective_food_service, has_health_staff,
--         health_staff_type, health_staff_count, has_nurse_or_nursing_assistant,
--         has_health_teacher, has_designated_health_manager, kindergarten_class_count
```

**(d) checklist_items.role 제약 확장**
```sql
alter table checklist_items drop constraint checklist_items_role_check;
alter table checklist_items add constraint checklist_items_role_check
  check (role in ('director','teacher','shuttle','cook_or_food_service','health_manager'));
```
> AI/타입 레벨 역할 키(`homeroom_teacher`, `bus_manager`)는 DB 저장 시 기존 키(`teacher`, `shuttle`)로 매핑. P11에서 cook/health 추가.

**(e) action_requests FK 일반화**
```sql
alter table action_requests rename column heatwave_profile_id to risk_profile_id;
-- FK 재지정: institution_risk_profiles(id)
```

**(f) after_action_records 일반화**
```sql
alter table after_action_records add column disaster_type text default 'heatwave';
alter table after_action_records add column checked_items jsonb default '{}'::jsonb;
-- 기존 boolean 5개는 레거시 유지, 신규는 checked_items 사용
```

**(g) 데이터 마이그레이션**
- 기존 `heatwave_profiles` 전 행 → `institution_risk_profiles(disaster_type='heatwave')`로 INSERT (특수필드 JSONB 패킹)
- 기존 테이블은 호환 뷰로 유지, P8 안정화 후 제거 검토

> **폭염 무중단 검증**: 마이그레이션 후 폭염 시연 경로(S0→S7)가 통과해야 P8 완료 조건 충족.

---

## 5. AI 공통 출력 스키마

### 5.1 공통 JSON 스키마 (`lib/ai/aiPlanSchema.ts` 교체)

```typescript
AiPlanSchema = z.object({
  disaster_type: z.enum(['heatwave', 'heavy_rain', 'infection']),
  disaster_summary:     z.string().min(1),
  priority:             z.enum(['critical','high','medium','low']),
  priority_reason:      z.string().min(1),
  reflected_evidence:   z.array(z.string()).min(1),
  missing_info:         z.array(z.string()).min(1),
  role_based_actions: z.array(z.object({
    role: z.enum(['director','homeroom_teacher','bus_manager',
                  'cook_or_food_service','health_manager']),
    role_label: z.string(),
    actions: z.array(z.string()),  // 빈 배열 허용 ("해당 없음" 처리)
  })).min(1),
  parent_notice: z.string().min(1),
  after_action_draft: z.object({
    checked_items:  z.record(z.string().nullable()),  // 유형별 동적 키
    notes:          z.string(),
    improvement:    z.string(),
  }),
  emergency_contact_guide:    z.string(),
  official_priority_notice:   z.string(),
  safety_disclaimer:          z.string(),
})
```

### 5.2 AI 파일 구조 재편 (`lib/ai/`)

```
lib/ai/
  systemPrompt.ts        # 공통 system prompt (유형 무관 안전규칙)
  buildSystemPrompt.ts   # 공통 + registry[type].policyBlock 조립
  aiPlanSchema.ts        # 공통 출력 스키마 (role_based_actions 배열)
  buildAiInput.ts        # disaster_type 동적, profile JSONB 직렬화(화이트리스트)
  callClaude.ts          # 호출/재시도/fallback (유지)
  legacyAdapter.ts       # 파생 getter (director_checklist 등 하위 호환)
  disaster/
    heatwave.ts          # policy block + output guidance
    heavyRain.ts
    infection.ts
```

### 5.3 공통 system prompt 필수 규칙 (유형 무관)
- JSON 객체 1개만 출력
- 의료 진단 금지 (119 수준 안내만)
- 공식기관·보건당국·119 지시 우선
- 학부모 안내문: 공포 금지, "기관이 조치 중" 전제
- AI API에 PII 전송 금지 (화이트리스트 직렬화)
- 부족한 정보는 `missing_info`에 기재
- `reflected_evidence`에 입력-출력 연결 명시

### 5.4 감염병 추가 금지 표현
- 질병명 확정·진단 금지
- "확진"은 사용자 명시 입력 시에만 사용
- 보건당국·의료기관·기관 매뉴얼 우선 안내 필수

### 5.5 유형별 policy block 요약

| 재난유형 | 핵심 지침 키워드 |
|---|---|
| 폭염 | 실외중단·실내전환·수분·냉방확인·온열취약 관찰·통학버스 내부온도 |
| 집중호우 | 실외중단·지하공간 사용중지·실내대기·출입구/창문/누수 확인·하원조정·통학버스 운행보류/우회·인원확인·침수/정전 시 지자체·119 |
| 감염병 | 유증상 분리대기·보호자연락·체온/증상기록·같은반 관찰·손위생/소독·환기·급식/화장실 위생·등원중지/귀가 안내문·전체 안내문 |

### 5.6 하위 호환 (`lib/ai/legacyAdapter.ts`)
```typescript
// 기존 코드가 참조하는 필드를 파생 getter로 제공
export function getChecklistByRole(result: AiPlanResult, role: string): string[]
// 예: getChecklistByRole(result, 'director') → role_based_actions에서 director 항목 추출
```

---

## 6. 재난유형별 입력정보 및 상황 버튼

### 6.1 폭염 (기존 유지 + 역할 확장 상황 추가)

**프로필 필드 (disaster_specific):**
`heat_vulnerable_count`, `respiratory_caution_count`, `mobility_support_count`, `special_support_count`, `cooling_ok`, `water_supply_ok`, `vehicle_thermometer`, `pickup_wait_place`

**현재상황 버튼 (registry.situations):**

| 상황 코드 | 표시 문구 |
|---|---|
| outdoor_before | 실외놀이 전 |
| outdoor_during | 실외놀이 중 |
| outing_planned | 산책·현장학습 예정 |
| meal_time | 급식 전후 |
| nap_time | 낮잠 시간 |
| pickup_ready | 하원 준비 |
| bus_boarding | 통학버스 탑승 전 |
| cooling_issue | 냉방 이상 있음 |
| heat_symptom | 온열증상 의심 유아 있음 |
| kitchen_temp | 조리실 온도 상승 (역할 확장) |
| ingredient_check | 급식 식재료 보관 확인 필요 (역할 확장) |

### 6.2 집중호우

**프로필 필드 (disaster_specific):**
`is_low_ground`, `near_river_or_slope`, `has_underground_space`, `first_floor_entrance_type`, `pickup_waiting_area`, `outdoor_playground_location`, `has_bus`, `indoor_waiting_space`, `has_emergency_contact`, `evacuation_space`

**현재상황 버튼:**

| 상황 코드 | 표시 문구 |
|---|---|
| outdoor_before | 실외놀이 전 |
| outdoor_during | 실외놀이 중 |
| pickup_ready | 하원 준비 |
| bus_before | 통학버스 운행 전 |
| bus_during | 통학버스 운행 중 |
| underground_in_use | 지하공간 사용 중 |
| field_trip_planned | 현장학습 예정 |
| flood_risk_nearby | 기관 주변 침수 우려 |
| pickup_delay_possible | 보호자 인계 지연 가능 |
| power_outage_or_leak | 정전·누수 발생 |
| kitchen_leak | 조리실 누수·정전 우려 (역할 확장) |
| meal_delay | 급식 제공 지연 가능 (역할 확장) |
| anxious_child | 낙상·불안 반응 유아 있음 (역할 확장) |

### 6.3 감염병

**프로필 필드 (disaster_specific):**
`class_child_counts`, `has_infant_class`, `special_support_count`, `has_health_room`, `has_thermometer`, `has_sanitizer_and_mask`, `parent_contact_method`, `has_infection_manual`, `suspension_notice_template`

**현재상황 버튼:**

| 상황 코드 | 표시 문구 |
|---|---|
| fever_symptom | 유증상/발열 유아 있음 |
| vomit_diarrhea | 구토·설사 유아 있음 |
| respiratory_symptom | 호흡기 증상 유아 있음 |
| same_class_cluster | 같은 반 유사증상 반복 |
| parent_contact_needed | 보호자 연락 필요 |
| suspension_notice_needed | 등원중지 안내 필요 |
| classroom_disinfection | 교실 소독 필요 |
| meal_hygiene | 급식·화장실 위생 강화 |
| staff_symptom | 교직원 유증상 |
| parent_notice_needed | 학부모 안내문 발송 필요 |
| cook_symptom | 조리종사자 유증상 (역할 확장) |
| kitchen_hygiene | 급식·식기 위생 강화 (역할 확장) |

> **감염병 입력 흐름**: 재난문자 없이 상황 입력만으로 AI 생성 가능 (`disaster_message_text` 옵션화).

---

## 7. 역할별 체크리스트 구조 (5역할 × 3재난유형)

`role_based_actions` 배열에 유형×역할 조합으로 생성. 비활성 역할은 `actions: []` 또는 "해당 없음".

| 역할 | 폭염 | 집중호우 | 감염병 |
|---|---|---|---|
| **원장** (director) | 전반 지휘·안내 발송·시설 점검 지시 | 실외중단·지하중지·하원조정·지자체연락 판단 | 분리대기·등원중지 안내·매뉴얼 발동 |
| **담임교사** (homeroom_teacher) | 실내전환·수분·온열관찰 | 인원확인·실내대기·창문/누수 확인 | 증상 관찰·분리·같은반 관찰·환기 |
| **통학버스담당자** (bus_manager) | 내부온도 확인·환기 | 운행보류/우회·경로 침수 확인 | (해당 시) 차내 위생·환기 |
| **조리사/급식담당자** (cook_or_food_service) | 식재료 냉장·조리실 온도/환기·식중독 예방·배식 전 상태 확인 | 정전/누수 시 식재료 보관·급식 제공 가능 여부·조리실 침수 확인 | 종사자 건강·손위생·식기 소독·교차오염 방지·급식 중 유증상 대응 |
| **보건담당자** (health_manager) | 온열증상 관찰·체온·시원한 공간 이동·119 기준 안내 | 낙상/저체온/불안 반응 관찰·119/보호자 연락 안내 | 발열/구토/설사/호흡기 분리대기·보호자 연락·같은반 관찰·보건당국 우선 안내 |

> **조리사**: 식품위생·급식관리·조리실 안전 중심.
> **보건담당자**: 관찰·분리·보호자 연락·공식기관 안내 중심. 진단·치료 표현 금지.

---

## 8. 행안부 API 연동 확장 계획

### 8.1 엔드포인트 및 인증
- **엔드포인트**: `https://www.safetydata.go.kr/V2/api/DSSP-IF-00247`
- **인증키**: `serviceKey` 쿼리 파라미터 = env `MOIS_DISASTER_API_KEY` (`lib/env.ts`에서 로드)
- **키 확인 필수**: 구현 착수 시 `.env.local`의 실제 변수명이 `MOIS_DISASTER_API_KEY`와 일치하는지 확인. 불일치 시 `env.ts` 또는 `.env.local` 키명 통일.
- **서버 전용**: 클라이언트 노출 금지 (`app/api/external/disaster-sms/route.ts` 경유)

### 8.2 현재 한계 및 확장 작업 (`lib/external/disasterSms.ts`)

| 항목 | 현재 | 확장 후 |
|---|---|---|
| `disaster_type` | `'heatwave'` 하드코딩 | `classifyDisasterType(item)` 분류 함수 도입 |
| 함수 시그니처 | `fetchRecentDisasterSms(sido)` | `fetchRecentDisasterSms(sido, disasterType?)` |
| 응답 파싱 | 기본 구조 | V2 래퍼(`json.body` vs `json.response.body.items`) 검증 및 견고화 |
| fallback | 샘플 3종 (폭염) | 유형별 샘플 3종 × 3유형 |

### 8.3 `classifyDisasterType()` 분류 로직
- 행안부 응답의 `DST_SE_NM` / `EMRG_STEP_NM` 필드 또는 `MSG_CN` 본문 키워드로 분류
- 반환값: `'heatwave' | 'heavy_rain' | 'infection' | 'other'`
- `fetchRecentDisasterSms(sido, disasterType?)`: 유형 파라미터로 메시지 필터링

### 8.4 유형별 API 연동 전략

| 재난유형 | 행안부 재난문자 | 기상청 | 주소/좌표 |
|---|---|---|---|
| 폭염 | ✅ 기존 연동 | 단기예보 + 폭염영향예보 | Kakao (기존) |
| 집중호우 | ✅ 유형 필터 추가 | 단기/초단기예보 강수량 | Kakao (기존) |
| 감염병 | ✅ 옵션 (보건당국 안내문자) | 해당 없음 | 해당 없음 |

### 8.5 Fallback 보장
- `USE_SAMPLE_FALLBACK=true` 또는 `MOIS_DISASTER_API_KEY` 미설정 → 3유형 전부 샘플 반환
- `withApiFallback` 패턴 유지 (키 없음/타임아웃/에러 → 샘플 + `source` 메타)

---

## 9. seed.sql 확장 계획 (`supabase/seed.sql`)

기존 폭염 데이터 유지 + 아래 추가:

| 항목 | 폭염 | 집중호우 | 감염병 |
|---|---|---|---|
| 샘플 재난문자 | 기존 3종 유지 | 호우경보 1종 | 보건당국 안내 1종 (선택) |
| `institution_risk_profiles` | 기존 이관 + staff_profile 일부 추가 | 저지대·지하공간 케이스 1~2건 | 보건실 유무 케이스 1건 |
| `action_requests` + 결과 | 기존 유지 | 5역할 샘플 결과 1건 | 5역할 샘플 결과 1건 |
| `checklist_items` | 기존 유지 | 5역할 펼쳐 삽입 | 5역할 펼쳐 삽입 |

---

## 10. 샘플 파일 구조 (`lib/sample/`)

```
lib/sample/
  institutions.ts   (기존 유지)
  messages.ts       (유형별 샘플 추가)
  results/
    heatwave.ts     (기존 → role_based_actions 구조로 변환)
    heavyRain.ts    (신규)
    infection.ts    (신규)
```
- 입력 `disaster_type`에 맞는 샘플 자동 선택
- AI 파싱 실패 시 1회 재시도 → 해당 유형 샘플 fallback

---

## 11. 신규/수정 파일 목록

### 신규 파일
| 파일 | 역할 |
|---|---|
| `supabase/migrations/0002_disaster_expansion.sql` | DB 마이그레이션 |
| `lib/disaster/registry.ts` | 유형별 상황·프로필필드·라벨 정의 |
| `lib/disaster/types.ts` | DisasterType, RoleKey 등 공통 타입 |
| `lib/ai/systemPrompt.ts` | 공통 system prompt |
| `lib/ai/buildSystemPrompt.ts` | 공통 + policy block 조립 |
| `lib/ai/disaster/heatwave.ts` | 폭염 policy block |
| `lib/ai/disaster/heavyRain.ts` | 집중호우 policy block |
| `lib/ai/disaster/infection.ts` | 감염병 policy block |
| `lib/ai/legacyAdapter.ts` | 파생 getter (하위 호환) |
| `lib/staff/roleRecommendation.ts` | 역할 추천 로직 (법적 단정 금지) |
| `lib/sample/results/heatwave.ts` | 폭염 샘플 결과 (새 구조) |
| `lib/sample/results/heavyRain.ts` | 집중호우 샘플 결과 |
| `lib/sample/results/infection.ts` | 감염병 샘플 결과 |
| `app/plan/new/type/page.tsx` | 재난유형 선택 화면 |
| `docs/11_DISASTER_TYPE_EXPANSION_PLAN.md` | 본 문서 |

### 수정 파일
| 파일 | 변경 내용 |
|---|---|
| `lib/types/db.ts` | DisasterType·RoleKey enum, RiskProfile, AiPlanResult role_based_actions, SituationCode 유형별 |
| `lib/types/wizard.ts` | `disaster_type` 추가, `disaster_message_text` 옵션화 |
| `lib/ai/aiPlanSchema.ts` | role_based_actions 배열 구조로 교체 |
| `lib/ai/buildAiInput.ts` | disaster_type 동적, profile JSONB 직렬화 |
| `lib/ai/callClaude.ts` | 유형별 샘플 fallback 분기 |
| `lib/external/disasterSms.ts` | disaster_type 하드코딩 제거, classifyDisasterType 추가, 유형 파라미터, 응답 파싱 견고화 |
| `lib/external/weather.ts` | 유형 파라미터화 |
| `lib/env.ts` | MOIS_DISASTER_API_KEY 변수명 확인 |
| `app/api/plan/generate/route.ts` | risk_profile 조회, role_based_actions checklist 펼침 |
| `app/api/institutions/[id]/profile/route.ts` | 유형별 프로필 저장 |
| `components/plan/SituationPicker.tsx` | registry.situations 동적 로드 |
| `components/plan/MessageInput.tsx` | 유형별 샘플 분기, 감염병 2-모드 토글 |
| `components/plan/PlanResult.tsx` | role_based_actions 기반 탭 동적 생성 |
| `components/institutions/InstitutionForm.tsx` | 급식·보건 인력 입력 섹션 |
| `components/institutions/ProfileForm.tsx` | 재난유형별 프로필 탭 |
| `app/admin/page.tsx` | 재난유형별 생성 현황 |
| `supabase/seed.sql` | 집중호우·감염병 데이터 추가 |
| `docs/00,01,02,03,04,05,06,09,10` | 확장 내용 반영 갱신 |

---

## 12. 구현 태스크 체크리스트 (P8~P11)

### P8 — 공통화 리팩터링 (폭염 동작 유지)

- [ ] **T8-1**: `lib/disaster/types.ts` + `registry.ts` 스캐폴딩 (폭염만 등록). `wizard.ts`에 `disaster_type` 추가 (기본값 heatwave). `.env.local`의 `MOIS_DISASTER_API_KEY` 변수명 일치 확인.
- [ ] **T8-2**: `0002` 마이그레이션 실행 — `institution_risk_profiles` + `staff_profile` + enum 제약 + role CHECK 확장 + `after_action checked_items` + heatwave 데이터 이관. **로컬 폭염 스모크 통과 확인**.
- [ ] **T8-3**: AI 스키마 `role_based_actions` 배열로 전환 + `legacyAdapter` 추가 + system prompt 분리 (폭염 policy block). 샘플 결과를 새 구조로 변환.
- [ ] **T8-4**: `buildAiInput` / `generate route` / `PlanResult` / `SituationPicker`를 registry·role_based_actions 기반으로 전환 (폭염 경로 그대로 동작). `/privacy-safety-review` + `/ai-json-contract` + `/demo-readiness` 실행.
- [ ] **T8-5**: 재난유형 선택 화면 `/plan/new/type` 추가 (현재 폭염만 활성, 나머지 "준비중" 비활성 가능).

### P9 — 집중호우

- [ ] **T9-1**: registry에 `heavy_rain` 상황·프로필필드·policy block·output guidance 등록.
- [ ] **T9-2**: 프로필 폼/입력화면 유형 분기. `disasterSms.ts` 확장 — `disaster_type` 하드코딩 제거 + `classifyDisasterType(item)` + `fetchRecentDisasterSms(sido, disasterType?)` + 실제 V2 응답 래퍼 구조 검증. `weather.ts` 유형 파라미터화. **MOIS 실 API 1회 호출로 응답 구조 확인** + 미설정/오류 시 샘플 fallback 검증.
- [ ] **T9-3**: 샘플 메시지·프로필·결과 (5역할 일부) + seed. 시연 경로 B harness. `/api-fallback-check`.

### P10 — 감염병

- [ ] **T10-1**: registry에 `infection` 등록 (재난문자 옵션화, 2-모드 입력 — 보건당국 안내문자 / 기관 내 상황 입력).
- [ ] **T10-2**: 감염병 금지 표현 강화 (진단/확진 표현 제거), 보건당국 우선 문구 추가. **/privacy-safety-review 집중**.
- [ ] **T10-3**: 샘플·seed·시연 경로 C harness.

### P11 — 역할 확장 (조리사·보건담당자)

- [ ] **T11-1**: RoleKey에 `cook_or_food_service`·`health_manager` 추가. `checklist_items` role CHECK 확장 (0002에 이미 포함 가능). 역할 라벨·탭 동적화 확인.
- [ ] **T11-2**: registry 각 유형 policy block에 두 역할 출력 가이드 추가. 샘플 결과 5역할 완성.
- [ ] **T11-3**: `roleRecommendation.ts` + 프로필 폼 급식·보건 인력 입력 + 추천 문구 (법적 단정 금지).
  - 어린이집 40명+ 조리원 권장, 100명+ 간호사/보건담당자·영양사 확인, 1회 급식 50명+ 집단급식소 기준 확인
  - 유치원 사립 100명+ 영양교사 확인, 36학급+ 보건교사 2인 확인
  - 표현: "배치 의무입니다"(금지) → **"배치 기준 확인이 필요합니다"**(허용)
- [ ] **T11-4**: 관리자 대시보드 역할 지정 현황 추가. 3개 시연 경로 전체 5역할 완주 + **/demo-readiness 최종**.

### 마무리 (각 P 완료 시)
- [ ] `docs/07_CONTEXT_LEDGER.md` 갱신
- [ ] 의사결정 `docs/08_DECISION_LOG.md` 기록 (절대날짜)
- [ ] 폭염 회귀 스모크(S0→S7) 통과 확인

---

## 13. 시연 경로 (harness 고정)

| 경로 | 재난유형 | 현재상황 | 목표 |
|---|---|---|---|
| **경로 A** (기존) | 폭염 | 실외놀이 전·하원 준비·통학버스 탑승 전 | 5역할 체크리스트 |
| **경로 B** (신규) | 집중호우 | 하원 준비·통학버스 운행 전·지하공간 사용 중 | 원장·교사·차량·조리·보건 체크리스트 |
| **경로 C** (신규) | 감염병 | 발열 유아 발생·보호자 연락 필요·교실 소독 필요 | 원장·교사·보건(+조리) 체크리스트 + 학부모 안내문 |

> 각 경로는 API/AI/DB 실패 시에도 샘플 fallback으로 완주 보장.

---

## 14. 검증 방법

| 검증 항목 | 방법 | 실행 시점 |
|---|---|---|
| **폭염 회귀** | 폭염 시연 경로 S0→S7 스모크 완주. `npm run build` + typecheck 무오류. | 각 P 단계 완료 후 |
| **샘플 fallback** | `USE_SAMPLE_FALLBACK=true` 에서 3개 유형 전 흐름 완주 (API/AI/DB 없이). | 각 P 단계 완료 후 |
| **PII 검사** | AI 입력 직렬화에 PII 0건 확인. 감염병 입력에 이름/진단명/연락처 컬럼 부재 확인. `/privacy-safety-review` 실행. | T8-4, T10-2, 각 P 완료 후 |
| **AI 계약** | 3유형 출력이 공통 스키마 통과. 파싱 실패 시 1회 재시도 → 유형별 샘플 fallback. `/ai-json-contract` 실행. | T8-3, T9-3, T10-3 |
| **시연 완주** | 경로 A/B/C 각각 모바일 화면에서 3분 내 완주. `/demo-readiness` 실행. | T8-4, P11 최종 |
| **API fallback** | 행안부 키 미설정·타임아웃·오류 시 샘플 전환 + `source` 메타 확인. `/api-fallback-check` 실행. | T9-2, T9-3 |

---

## 15. 역할 추천 로직 원칙 (`lib/staff/roleRecommendation.ts`)

기관 type + 현원 + 학급 수 입력 → "권장/기본활성화/확인안내" 문구 배열 반환.

- **어린이집**: 40명+ 조리원 권장 / 100명+ 간호사·영양사 확인 / 1회 급식 50명+ 집단급식소 기준 확인
- **유치원(사립)**: 100명+ 영양교사 확인 / 36학급+ 보건교사 2인 확인
- **금지 표현**: "배치 의무입니다"
- **허용 표현**: "배치 기준 확인이 필요합니다" (근거 기준은 표시 허용)

> 법적 의무 단정 금지. 확인 안내 문구에 그친다.

---

## 부록 A. 현재 하드코딩 지점 (P8 제거 대상)

| 계층 | 파일 | 내용 |
|---|---|---|
| AI 입력 | `lib/ai/buildAiInput.ts:9,54` | `disaster_type: 'heatwave'` 고정, `heatwave_profile` 필드명 |
| 시스템 프롬프트 | `lib/ai/callClaude.ts:12-23` | "폭염 재난대응" 전용 문구 |
| AI 출력 스키마 | `lib/ai/aiPlanSchema.ts:10-22` | `director/teacher/shuttle_checklist` 3개 고정 |
| 타입 | `lib/types/db.ts:7-21,45-61,124-136` | `ChecklistRole` 3개, `SituationCode` 11개 폭염 전용 |
| DB 테이블 | `supabase/migrations/0001_initial.sql:52-88` | `heatwave_profiles` 테이블명·폭염 전용 컬럼 |
| DB FK | `0001_initial.sql:116,123,137` | `action_requests.heatwave_profile_id`, `checklist_items.role CHECK 3개` |
| 외부 API | `lib/external/disasterSms.ts:61` | 조회 결과를 `disaster_type:'heatwave'`로 덮어씀 |
| 샘플 | `lib/sample/*.ts` | 메시지·프로필·결과 전부 폭염 |
| UI 상황 | `components/plan/SituationPicker.tsx:13-25` | 11개 폭염 상황 버튼 고정 |
| UI 결과 | `components/plan/PlanResult.tsx:16-21` | TABS 4개 하드코딩 |
| UI 프로필 | `components/institutions/ProfileForm.tsx` | 폭염 전용 필드 폼 |

---

## 부록 B. 이미 범용적인 부분 (재사용 가능)

- `disaster_messages.disaster_type` 컬럼 (기본값 `'heatwave'`, enum화만 필요)
- `action_requests.result_json JSONB` (스키마 변경에 유연)
- `action_requests.selected_situations text[]` (컬럼명 중립)
- `ChecklistCard.tsx`, `ParentNoticeCard.tsx` (데이터 기반, 역할/유형 무관)
- `lib/external/withFallback.ts`의 `withApiFallback` 패턴
- `app/page.tsx` 역할 선택, `app/admin/page.tsx` 대시보드
