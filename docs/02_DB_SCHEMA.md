# 02_DB_SCHEMA — 데이터베이스 설계 (Supabase PostgreSQL)

> 대상: Supabase PostgreSQL. 모든 PK는 `uuid`(`gen_random_uuid()`), 모든 테이블에 `created_at timestamptz default now()`.
> **개인정보 원칙(필수)**: 유아 이름·진단명·약물명·보호자 연락처 컬럼은 **존재하지 않는다**. 취약 유아 정보는 **숫자 집계값**만 저장한다. 자유텍스트 컬럼에도 개인식별정보 입력을 금지한다(앱·프롬프트 차원 차단).

---

## 1. ERD 개요

```
institutions (1) ──< (N) heatwave_profiles
institutions (1) ──< (N) disaster_messages        (기관이 입력/선택한 재난문자)
institutions (1) ──< (N) action_requests
disaster_messages (1) ──< (N) action_requests
heatwave_profiles (1) ──< (N) action_requests     (생성 시점 프로필 참조)
action_requests (1) ──< (N) checklist_items
action_requests (1) ──< (1) after_action_records
```

> 설계 메모: 체크리스트는 **(a) `action_requests.result_json` 안에 통째로 보관**하고, 동시에 **(b) `checklist_items` 테이블로 정규화**해 체크 상태(완료여부)를 갱신·집계할 수 있게 둔다. MVP 데모는 (a)만으로도 렌더 가능하며, (b)는 체크 토글·진행률 표시에 사용한다.

---

## 2. 테이블 상세

### 2.1 `institutions` — 기관 기본정보
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
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | 트리거로 갱신 |

- **인덱스**: `(sido, sigungu)`, `(type)`, `(created_at)`.
- **관계**: 1:N → heatwave_profiles, disaster_messages, action_requests.

### 2.2 `heatwave_profiles` — 폭염 대응 프로필 (집계값만)
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

- **인덱스**: `(institution_id)`, 부분 인덱스 `(institution_id) WHERE is_current`.
- **PII 없음**: 이름/진단명/약물명/연락처 컬럼 부재. 전부 숫자 집계 또는 boolean.

### 2.3 `disaster_messages` — 재난문자
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| institution_id | uuid FK → institutions(id) ON DELETE CASCADE | nullable(공용 샘플은 null 허용) |
| disaster_type | text default `'heatwave'` | 1차: 폭염만. 확장 대비 컬럼 |
| source | text NOT NULL | `'sample'` / `'manual'` / `'api'` |
| raw_text | text NOT NULL | 재난문자 원문 |
| summary | text | AI 생성 요약(선택 캐시) |
| issued_at | timestamptz | 발령 시각(있으면) |
| received_at | timestamptz default now() | 기관 확인/접수 시각 |
| created_at | timestamptz default now() | |

- **인덱스**: `(institution_id)`, `(source)`, `(disaster_type)`.

### 2.4 `action_requests` — 대응계획 생성 요청·결과
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| institution_id | uuid NOT NULL FK → institutions(id) ON DELETE CASCADE | |
| disaster_message_id | uuid FK → disaster_messages(id) ON DELETE SET NULL | |
| heatwave_profile_id | uuid FK → heatwave_profiles(id) ON DELETE SET NULL | 생성 시점 프로필 |
| selected_situations | text[] | 현재 상황(최대 3). 코드값 배열 |
| situation_etc | text | '기타 직접 입력' 내용 |
| priority | text | `'high'`/`'medium'`/`'low'` (AI 산출 대응 우선순위) |
| result_json | jsonb NOT NULL | AI 출력 전체(04 스키마). fallback 결과도 동일 형식 저장 |
| is_fallback | boolean default false | 샘플 fallback로 생성됐는지 |
| model | text | 사용 모델명(예: `claude-haiku-4-5`) 또는 `'sample'` |
| created_by_role | text | `'admin'`/`'director'`/`'teacher'`/`'shuttle'` (시연용 역할) |
| created_at | timestamptz default now() | |

- **인덱스**: `(institution_id, created_at desc)`, `(priority)`, `(created_at)`, GIN `(result_json)` (선택).
- **관계**: 1:N → checklist_items, 1:1 → after_action_records.

### 2.5 `checklist_items` — 역할별 체크리스트 항목
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| action_request_id | uuid NOT NULL FK → action_requests(id) ON DELETE CASCADE | |
| role | text NOT NULL | `'director'`/`'teacher'`/`'shuttle'`. CHECK |
| sort_order | int default 0 | 표시 순서 |
| content | text NOT NULL | 체크리스트 문구 |
| is_done | boolean default false | 완료 여부(체크 토글) |
| done_at | timestamptz | 완료 시각 |
| created_at | timestamptz default now() | |

- **인덱스**: `(action_request_id, role, sort_order)`.
- **메모**: `result_json` 내 체크리스트를 펼쳐 INSERT. 데모에서 체크 토글·진행률 집계에 사용.

### 2.6 `after_action_records` — 사후기록
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| action_request_id | uuid NOT NULL FK → action_requests(id) ON DELETE CASCADE | |
| institution_id | uuid NOT NULL FK → institutions(id) ON DELETE CASCADE | 조회 편의 |
| message_checked_at | timestamptz | 재난문자 확인 시각 |
| outdoor_adjusted | boolean | 실외활동 조정 여부 |
| cooling_checked | boolean | 냉방 확인 여부 |
| child_health_issue | boolean | 유아 건강 이상 여부(예/아니오만, 상세 식별정보 금지) |
| parents_notified | boolean | 학부모 안내 여부 |
| shuttle_checked | boolean | 통학버스 확인 여부 |
| completed_by | text | 조치 완료자(직함/역할 권장, 실명 지양) |
| notes | text | 특이사항(개인식별정보 입력 금지 안내) |
| improvement | text | 개선 필요사항 |
| created_at | timestamptz default now() | |

- **인덱스**: `(institution_id, created_at desc)`, `(action_request_id)`.

---

## 3. ENUM/CHECK 정리
- `institutions.type` ∈ {`daycare`,`kindergarten`}
- `heatwave_profiles.pickup_wait_place` ∈ {`indoor`,`shade`,`outdoor`,`etc`}
- `disaster_messages.source` ∈ {`sample`,`manual`,`api`}
- `action_requests.priority` ∈ {`high`,`medium`,`low`}
- `action_requests.created_by_role` / `checklist_items.role` ∈ {`admin`,`director`,`teacher`,`shuttle`} (checklist_items는 admin 제외)
- `selected_situations` 코드값 ∈ {`before_outdoor`,`during_outdoor`,`field_trip_planned`,`meal_time`,`nap_time`,`pickup_prep`,`before_shuttle`,`cooling_issue`,`heat_symptom_suspected`,`no_special`,`etc`}

> MVP는 단순화를 위해 text + CHECK 제약을 사용(PostgreSQL ENUM 타입 대신 마이그레이션 유연성 우선). 확장 시 ENUM 전환 가능.

---

## 4. RLS(Row Level Security) 정책 초안

> 인증 방식이 **시연용 역할 선택**(실제 사용자 인증 없음)이므로, 민감 키 노출 없이 안정적인 데모를 위해 다음을 권장한다.

### MVP 권장 패턴 (서버 라우트 경유)
- 클라이언트는 `anon key`만 보유, **쓰기/민감 조회는 Next.js Server Route에서 `service_role` 키로 수행**.
- 테이블 RLS는 **활성화(enable)** 하되, 기본 정책은 다음 중 택1:
  - **(권장) 서버 전용 쓰기**: anon에 `SELECT`만 허용(데모 읽기), `INSERT/UPDATE/DELETE`는 정책 미부여 → service_role(서버)만 가능.
  - **(단순)** anon에 `SELECT/INSERT/UPDATE` 허용(빠른 데모용). 단, 공개 데모 URL이면 권장하지 않음.

```sql
alter table institutions enable row level security;
-- 읽기: 데모용 공개 읽기
create policy "read_all" on institutions for select to anon using (true);
-- 쓰기 정책은 부여하지 않음 → service_role(서버 라우트)만 INSERT/UPDATE 가능
```
> 위 패턴을 6개 테이블에 동일 적용. `after_action_records`·`heatwave_profiles`는 민감도 고려해 anon `SELECT`도 제한하고 서버 라우트로만 조회하는 것을 권장.

### 운영(공모전 이후) 강화 초안
- Supabase Auth 도입 시: `institution_id` 소유권 기반 정책(`auth.uid()` ↔ 기관 매핑 테이블), 지자체 관리자에게 `sido/sigungu` 범위 조회 정책 부여.
- service_role 키는 절대 클라이언트 노출 금지(서버 환경변수 전용).

---

## 5. 트리거/유틸
- `updated_at` 자동 갱신 트리거(`institutions`).
- 신규 프로필 INSERT 시 동일 기관의 기존 `is_current=true`를 false로 내리는 트리거(또는 앱 로직).

---

## 6. 샘플 데이터 계획 (시드)

| 테이블 | 시드 수량 | 내용 |
|---|---|---|
| institutions | 3~5 | 어린이집/유치원 혼합, 시도·시군구 다양, 통학버스 운영/미운영 혼합 |
| heatwave_profiles | 기관당 1 | 취약 유아 집계값·보유물품 다양화(냉방 이상 케이스 1곳 포함) |
| disaster_messages | 3 | 폭염주의보/폭염경보/야외활동 자제 강도별 샘플(`source='sample'`) |
| action_requests | 1~2 | 데모용 사전 생성 결과(`is_fallback` 케이스 1건 포함) |
| checklist_items | 결과 연동 | 위 action_requests의 역할별 항목 펼침 |
| after_action_records | 1 | 완료 예시 1건 |

- 시드는 `supabase/seed.sql` 또는 앱 시드 스크립트로 관리. **외부 의존 차단 시 동일 시드가 in-memory fallback의 원본**이 된다.
- 샘플 재난문자 원문·샘플 AI 결과는 `04_AI_PROMPT_SPEC.md`의 샘플과 일치시킨다.
