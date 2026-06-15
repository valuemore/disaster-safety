# 02_DB_SCHEMA — 데이터베이스 설계 (Supabase PostgreSQL)

> 대상: Supabase PostgreSQL. 모든 PK는 `uuid`(`gen_random_uuid()`), 모든 테이블에 `created_at timestamptz default now()`.
> **개인정보 원칙(필수)**: 유아 이름·진단명·약물명·보호자 연락처 컬럼은 **존재하지 않는다**. 취약 유아 정보는 **숫자 집계값**만 저장한다. 자유텍스트 컬럼에도 개인식별정보 입력을 금지한다(앱·프롬프트 차원 차단).
> 최종 갱신: **2026-06-16** (0002/0003 마이그레이션 완료 반영 — 3유형·5역할 확장)

---

## 1. ERD 개요

```
institutions (1) ──< (N) institution_risk_profiles    [0002 신규 — 3유형 범용 프로필]
institutions (1) ──< (N) heatwave_profiles            [레거시 — 호환 뷰 유지, 제거 검토 예정]
institutions (1) ──< (N) disaster_messages            [기관이 입력/선택한 재난문자]
institutions (1) ──< (N) action_requests
disaster_messages (1) ──< (N) action_requests
institution_risk_profiles (1) ──< (N) action_requests  [risk_profile_id FK, 0002 신규]
action_requests (1) ──< (N) checklist_items
action_requests (1) ──< (1) after_action_records
```

> 설계 메모: 체크리스트는 **(a) `action_requests.result_json` 안에 통째로 보관**하고, 동시에 **(b) `checklist_items` 테이블로 정규화**해 체크 상태(완료여부)를 갱신·집계할 수 있게 둔다. MVP 데모는 (a)만으로도 렌더 가능하며, (b)는 체크 토글·진행률 표시에 사용한다.

---

## 2. 마이그레이션 파일 목록

| 파일 | 내용 | 상태 |
|---|---|---|
| `supabase/migrations/0001_initial.sql` | 기초 6개 테이블(institutions, heatwave_profiles, disaster_messages, action_requests, checklist_items, after_action_records), RLS, 트리거, 시드 | 완료 |
| `supabase/migrations/0002_disaster_expansion.sql` | institution_risk_profiles 신규, staff_profile 컬럼, disaster_type CHECK 3종, checklist_items.role 5종 확장, risk_profile_id, after_action checked_items, heatwave 데이터 이관 | 완료 (원격 DB 적용) |
| `supabase/migrations/0003_role_expansion.sql` | cook_or_food_service·health_manager 역할 관련 추가 확장 (필요 시) | 참조용 |

---

## 3. 테이블 상세

### 3.1 `institutions` — 기관 기본정보
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| name | text NOT NULL | 기관명 |
| type | text NOT NULL | `'daycare'`(어린이집) / `'kindergarten'`(유치원). CHECK 제약 |
| address | text | 주소 |
| latitude | numeric(9,6) | 위도 |
| longitude | numeric(9,6) | 경도 |
| sido | text | 시도 |
| sigungu | text | 시군구 |
| dong | text | 행정동 |
| total_children | int | 전체 유아 수 |
| infant_count | int | 영아 수 |
| toddler_count | int | 유아 수 |
| staff_count | int | 교직원 수 |
| has_shuttle | boolean default false | 통학버스 운영 여부 |
| has_outdoor_playground | boolean default false | 실외놀이터 여부 |
| cooling_space_count | int default 0 | 냉방 가능 공간 수 |
| water_available | boolean default false | 물 공급 가능 여부 |
| **staff_profile** | **jsonb default '{}'** | **급식·보건 인력 정보 (0002 신규). `lib/staff/types.ts` StaffProfile 타입. PII 없음: 인력 유무·수·유형만.** |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | 트리거로 갱신 |

- **인덱스**: `(sido, sigungu)`, `(type)`, `(created_at)`.
- **관계**: 1:N → institution_risk_profiles, heatwave_profiles(레거시), disaster_messages, action_requests.

#### staff_profile JSONB 구조 (`lib/staff/types.ts` StaffProfile)
```
{
  // 급식 인력
  meal_count_per_serving?      : number,   // 1회 급식 제공 인원 (집단급식소 기준 판단)
  has_food_service_staff?      : boolean,
  food_service_staff_count?    : number,
  has_cook_license_staff?      : boolean,
  has_collective_food_service? : boolean,  // 집단급식소 신고 여부
  // 보건 인력
  has_health_staff?            : boolean,
  health_staff_type?           : 'nurse' | 'nursing_assistant' | 'health_teacher' | 'designated' | 'none',
  health_staff_count?          : number,
  has_nurse_or_nursing_assistant? : boolean,
  has_health_teacher?          : boolean,
  has_designated_health_manager?: boolean,
  // 유치원 전용
  kindergarten_class_count?    : number
}
```

### 3.2 `heatwave_profiles` — 폭염 대응 프로필 (**레거시 — 호환 보존**)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| institution_id | uuid NOT NULL FK → institutions(id) ON DELETE CASCADE | |
| heat_vulnerable_count | int default 0 | 온열취약 유아 수(집계) |
| respiratory_caution_count | int default 0 | 호흡기 주의 유아 수(집계) |
| mobility_support_count | int default 0 | 이동지원 필요 유아 수(집계) |
| special_support_count | int default 0 | 특별지원 필요 유아 수(집계) |
| cooling_ok | boolean default true | 냉방기 정상 여부 |
| indoor_alt_space | boolean default false | 실내 대체활동 공간 여부 |
| water_supply_ok | boolean default false | 정수기/물 공급 가능 여부 |
| thermometer | boolean default false | 체온계 보유 여부 |
| first_aid_kit | boolean default false | 구급함 보유 여부 |
| vehicle_thermometer | boolean default false | 차량 내부 온도계 보유 여부 |
| pickup_wait_place | text | 하원 대기 장소: `'indoor'`/`'shade'`/`'outdoor'`/`'etc'`. CHECK |
| is_current | boolean default true | 기관의 현재 유효 프로필 표시(최신 1건) |
| created_at | timestamptz default now() | |

- **0002 마이그레이션**: 기존 행을 `institution_risk_profiles(disaster_type='heatwave')`로 이관 완료. 이 테이블은 레거시 호환용으로 유지(제거 시 `docs/08_DECISION_LOG.md`에 절대날짜 기록).
- **접근**: `lib/disaster/profileMapping.ts`의 `riskProfileToHeatwave()` 어댑터 경유.

### 3.3 `institution_risk_profiles` — 범용 재난대응 프로필 (**0002 신규**)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| institution_id | uuid NOT NULL FK → institutions(id) ON DELETE CASCADE | |
| disaster_type | text NOT NULL | CHECK(`'heatwave'`, `'heavy_rain'`, `'infection'`) |
| thermometer | boolean NOT NULL default false | 체온계 보유 (공통) |
| first_aid_kit | boolean NOT NULL default false | 구급함 보유 (공통) |
| indoor_alt_space | boolean NOT NULL default false | 실내 대체활동/분리대기 공간 (공통) |
| disaster_specific | jsonb NOT NULL default '{}' | 유형별 특수 필드 |
| is_current | boolean NOT NULL default true | 기관×유형 현재 유효 프로필 표시 |
| created_at | timestamptz NOT NULL default now() | |

- **유니크 제약**: `(institution_id, disaster_type, is_current)` — 유형별 현재 프로필 1건 보장.
- **트리거**: 신규 INSERT 시 동일 `(institution_id, disaster_type)`의 기존 `is_current=true`를 false 처리.
- **RLS**: RLS 활성화. anon SELECT 허용, INSERT/UPDATE/DELETE는 service_role(서버 라우트) 전용.

#### `disaster_specific` JSONB 유형별 키

**폭염 (`disaster_type='heatwave'`):**
```
{
  heat_vulnerable_count        : number,   // 온열취약 유아 수 (집계)
  respiratory_caution_count    : number,
  mobility_support_count       : number,
  special_support_count        : number,
  cooling_ok                   : boolean,
  water_supply_ok              : boolean,
  vehicle_thermometer          : boolean,
  pickup_wait_place            : 'indoor' | 'shade' | 'outdoor' | 'etc' | null
}
```
→ TypeScript: `HeatwaveSpecific` (`lib/disaster/profileMapping.ts`)
→ 어댑터: `riskProfileToHeatwave()` / `heatwaveFormToRiskProfile()`

**집중호우 (`disaster_type='heavy_rain'`):**
```
{
  low_ground                   : boolean,  // 저지대 위치
  near_stream_or_slope         : boolean,  // 인근 하천·급경사지
  has_basement                 : boolean,  // 지하공간 보유
  entrance_type                : 'ground_level' | 'raised' | 'below_grade' | null,
  pickup_wait_area             : 'indoor' | 'covered_outdoor' | 'open_outdoor' | null,
  outdoor_playground_location  : 'rooftop' | 'ground_level' | 'none' | null,
  has_shuttle                  : boolean,
  has_alt_indoor_space         : boolean,
  has_emergency_contact_plan   : boolean,
  has_evacuation_space         : boolean,
  mobility_support_count       : number    // 이동지원 필요 유아 수 (집계)
}
```
→ TypeScript: `HeavyRainSpecific` (`lib/disaster/profileMapping.ts`)
→ 어댑터: `riskProfileToHeavyRain()` / `heavyRainFormToRiskProfile()`

**감염병 (`disaster_type='infection'`):**
```
{
  class_child_count            : number | null,  // 반별 총 유아 수 (집계, 이름 없음)
  has_infant_class             : boolean,
  special_support_count        : number,
  has_health_room              : boolean,        // 보건실/분리대기 공간
  has_hand_sanitizer           : boolean,
  has_mask                     : boolean,
  has_disinfectant             : boolean,
  guardian_contact_method      : 'app' | 'sms' | 'call' | 'board' | null,  // 개인 번호 없음
  has_infection_manual         : boolean,
  has_attendance_stop_template : boolean
}
```
→ TypeScript: `InfectionSpecific` (`lib/disaster/profileMapping.ts`)
→ 어댑터: `riskProfileToInfection()` / `infectionFormToRiskProfile()`

- **PII 없음**: 감염병 특수 필드에도 이름·진단명·연락처 없음. 집계값·boolean·enum만.

### 3.4 `disaster_messages` — 재난문자
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| institution_id | uuid FK → institutions(id) ON DELETE CASCADE | nullable(공용 샘플은 null 허용) |
| disaster_type | text default `'heatwave'` | **CHECK 제약(0002): `'heatwave'` / `'heavy_rain'` / `'infection'`** |
| source | text NOT NULL | `'sample'` / `'manual'` / `'api'` |
| raw_text | text NOT NULL | 재난문자 원문 |
| summary | text | AI 생성 요약(선택 캐시) |
| issued_at | timestamptz | 발령 시각(있으면) |
| received_at | timestamptz default now() | 기관 확인/접수 시각 |
| created_at | timestamptz default now() | |

- **인덱스**: `(institution_id)`, `(source)`, `(disaster_type)`.
- **감염병**: `disaster_message_id` nullable 허용 — 감염병은 재난문자 없이 기관 상황 입력만으로 AI 생성 가능.

### 3.5 `action_requests` — 대응계획 생성 요청·결과
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| institution_id | uuid NOT NULL FK → institutions(id) ON DELETE CASCADE | |
| disaster_message_id | uuid FK → disaster_messages(id) ON DELETE SET NULL | nullable |
| heatwave_profile_id | uuid FK → heatwave_profiles(id) ON DELETE SET NULL | **@deprecated** — 0002 이후 `risk_profile_id` 사용. P8 안정화 후 제거 검토. |
| **risk_profile_id** | **uuid FK → institution_risk_profiles(id) ON DELETE SET NULL** | **0002 신규 — 범용 프로필 참조** |
| selected_situations | text[] | 현재 상황(최대 3). 코드값 배열 (3유형 전체 SituationCode) |
| situation_etc | text | '기타 직접 입력' 내용 |
| priority | text | `'high'`/`'medium'`/`'low'` (AI 산출 대응 우선순위) |
| result_json | jsonb NOT NULL | AI 출력 전체(04 스키마, `role_based_actions` 포함). fallback 결과도 동일 형식 저장 |
| is_fallback | boolean default false | 샘플 fallback로 생성됐는지 |
| model | text | 사용 모델명(예: `claude-haiku-4-5`) 또는 `'sample'` |
| **created_by_role** | **text** | `'admin'`/`'director'`/`'teacher'`/`'shuttle'`/`'cook_or_food_service'`/`'health_manager'` (시연용 역할) |
| created_at | timestamptz default now() | |

- **인덱스**: `(institution_id, created_at desc)`, `(priority)`, `(created_at)`, GIN `(result_json)` (선택).
- **관계**: 1:N → checklist_items, 1:1 → after_action_records.

### 3.6 `checklist_items` — 역할별 체크리스트 항목
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| action_request_id | uuid NOT NULL FK → action_requests(id) ON DELETE CASCADE | |
| role | text NOT NULL | **CHECK(0002 확장): `'director'`/`'teacher'`/`'shuttle'`/`'cook_or_food_service'`/`'health_manager'`** |
| sort_order | int default 0 | 표시 순서 |
| content | text NOT NULL | 체크리스트 문구 |
| is_done | boolean default false | 완료 여부(체크 토글) |
| done_at | timestamptz | 완료 시각 |
| created_at | timestamptz default now() | |

- **인덱스**: `(action_request_id, role, sort_order)`.
- **역할 키 매핑**: AI/타입 레벨 역할 키(`homeroom_teacher` → `teacher`, `bus_manager` → `shuttle`)는 `lib/disaster/types.ts`의 `ROLEKEY_TO_DB_ROLE`으로 DB 저장 시 변환. `cook_or_food_service`·`health_manager`는 그대로 저장.
- **메모**: `result_json`의 `role_based_actions`를 펼쳐 INSERT. 데모에서 체크 토글·진행률 집계에 사용.

### 3.7 `after_action_records` — 사후기록
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| action_request_id | uuid NOT NULL FK → action_requests(id) ON DELETE CASCADE | |
| institution_id | uuid NOT NULL FK → institutions(id) ON DELETE CASCADE | 조회 편의 |
| message_checked_at | timestamptz | 재난문자 확인 시각 |
| outdoor_adjusted | boolean | (폭염 레거시) 실외활동 조정 여부 |
| cooling_checked | boolean | (폭염 레거시) 냉방 확인 여부 |
| child_health_issue | boolean | (폭염 레거시) 유아 건강 이상 여부(예/아니오만, 상세 식별정보 금지) |
| parents_notified | boolean | (폭염 레거시) 학부모 안내 여부 |
| shuttle_checked | boolean | (폭염 레거시) 통학버스 확인 여부 |
| completed_by | text | 조치 완료자(직함/역할 권장, 실명 지양) |
| notes | text | 특이사항(개인식별정보 입력 금지 안내) |
| improvement | text | 개선 필요사항 |
| **disaster_type** | **text default 'heatwave'** | **재난유형 (0002 신규 컬럼)** |
| **checked_items** | **jsonb default '{}'** | **재난유형별 동적 체크 항목 키-값 (0002 신규 컬럼). 신규 기록은 이 컬럼 사용.** |
| created_at | timestamptz default now() | |

- **인덱스**: `(institution_id, created_at desc)`, `(action_request_id)`.
- **폭염 레거시 boolean 5개**: 기존 행 호환을 위해 유지. 신규 대응계획(P8 이후)은 `checked_items` JSONB 사용.

---

## 4. ENUM/CHECK 정리

| 컬럼 | 허용값 |
|---|---|
| `institutions.type` | `daycare`, `kindergarten` |
| `heatwave_profiles.pickup_wait_place` | `indoor`, `shade`, `outdoor`, `etc` |
| `disaster_messages.source` | `sample`, `manual`, `api` |
| `disaster_messages.disaster_type` | **`heatwave`, `heavy_rain`, `infection`** (CHECK 제약, 0002) |
| `institution_risk_profiles.disaster_type` | `heatwave`, `heavy_rain`, `infection` |
| `action_requests.priority` | `high`, `medium`, `low` |
| `action_requests.created_by_role` | `admin`, `director`, `teacher`, `shuttle`, **`cook_or_food_service`**, **`health_manager`** |
| `checklist_items.role` | `director`, `teacher`, `shuttle`, **`cook_or_food_service`**, **`health_manager`** (0002 확장) |

- **AI 출력 역할 키**: `director`, `homeroom_teacher`, `bus_manager`, `cook_or_food_service`, `health_manager` (DB 저장 시 `homeroom_teacher`→`teacher`, `bus_manager`→`shuttle` 변환).
- `selected_situations` 코드값: 3유형 전체 `SituationCode` (`lib/types/db.ts` 참조).

> MVP는 단순화를 위해 text + CHECK 제약을 사용(PostgreSQL ENUM 타입 대신 마이그레이션 유연성 우선). 확장 시 ENUM 전환 가능.

---

## 5. RLS(Row Level Security) 정책 초안

> 인증 방식이 **시연용 역할 선택**(실제 사용자 인증 없음)이므로, 민감 키 노출 없이 안정적인 데모를 위해 다음을 권장한다.

### MVP 권장 패턴 (서버 라우트 경유)
- 클라이언트는 `anon key`만 보유, **쓰기/민감 조회는 Next.js Server Route에서 `service_role` 키로 수행**.
- 테이블 RLS는 **활성화(enable)** 하되, 기본 정책:
  - **(권장) 서버 전용 쓰기**: anon에 `SELECT`만 허용(데모 읽기), `INSERT/UPDATE/DELETE`는 정책 미부여 → service_role(서버)만 가능.

```sql
alter table institutions enable row level security;
create policy "read_all" on institutions for select to anon using (true);
-- 쓰기 정책은 부여하지 않음 → service_role(서버 라우트)만 INSERT/UPDATE 가능
```
> 위 패턴을 모든 테이블(`institution_risk_profiles` 포함)에 동일 적용. `after_action_records`·`institution_risk_profiles`는 민감도 고려해 서버 라우트로만 조회.

### 운영(공모전 이후) 강화 초안
- Supabase Auth 도입 시: `institution_id` 소유권 기반 정책, 지자체 관리자에게 `sido/sigungu` 범위 조회 정책.
- service_role 키는 절대 클라이언트 노출 금지.

---

## 6. 트리거/유틸
- `updated_at` 자동 갱신 트리거(`institutions`).
- 신규 프로필 INSERT 시 동일 `(institution_id, disaster_type)` 기존 `is_current=true`를 false로 내리는 트리거(`institution_risk_profiles`).
- 기존 `heatwave_profiles`의 `is_current` 트리거는 레거시 유지.

---

## 7. 샘플 데이터 계획 (시드)

| 테이블 | 시드 수량 | 내용 |
|---|---|---|
| institutions | 3~5 | 어린이집/유치원 혼합, 시도·시군구 다양, 통학버스 운영/미운영, staff_profile 포함 |
| institution_risk_profiles | 유형별 1~2건 | 폭염·집중호우·감염병 각 1~2건 (`supabase/seed.sql`) |
| heatwave_profiles | 레거시 | 0002 이관 후 기존 3건 유지(호환) |
| disaster_messages | 3유형 × 3종 = 9종 | 폭염/집중호우/감염병 샘플. `source='sample'`. 감염병 2건은 `disaster_message_id=null` 허용 |
| action_requests | 3 | 유형별 1건씩 (5역할 result_json, is_fallback=true 케이스 포함) |
| checklist_items | 결과 연동 | 3유형 × 5역할 항목 펼침. 감염병: 23건(director 6, teacher 5, shuttle 2, cook 4, health 6) |
| after_action_records | 1 | 완료 예시 1건 (checked_items JSONB 포함) |

- 시드: `supabase/seed.sql` (멱등 — ON CONFLICT DO NOTHING, 고정 UUID).
- `lib/sample/` TS 픽스처: institutions/heatwave_profiles/disaster_messages/action_results/heavy_rain_profiles/infection_profiles/results/*.
- 외부 의존 차단 시 동일 샘플이 in-memory fallback의 원본이 된다.
