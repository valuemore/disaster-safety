# 03_API_INTEGRATION_PLAN — 공공 API 연동 계획

> 방침: 공공 API 연동은 **가산점**이며 **필수가 아니다**. **모든 API는 실패 시 샘플 데이터 모드로 자동 전환**되어야 하고, 데모 흐름은 절대 끊기지 않는다.
> 모든 외부 호출은 **Next.js Server Route(서버)에서만** 수행한다(키 노출 방지, CORS 회피, 캐시·타임아웃 일원화).
> 확정 결정: **가능한 많이 연동**하되, 우선순위에 따라 단계적으로 붙이고 fallback을 먼저 보장한다.
> 최종 갱신: **2026-06-16** (R-series 반영 — 어린이집포털 API 연동·재난유형 자동분류·발송(SMS/알림톡) 추가)

---

## 1. 공통 연동 원칙

- **위치**: `app/api/external/*` Server Route. 클라이언트는 내부 API만 호출.
- **fallback 자동화**: 각 외부 호출은 `try → 실패/타임아웃/키없음 → 샘플 응답 반환` 구조. 응답에 `source: 'api' | 'sample'` 메타 포함.
- **강제 토글**: `USE_SAMPLE_FALLBACK=true`면 외부 호출을 시도하지 않고 즉시 샘플 반환(오프라인 데모).
- **타임아웃/재시도**: 기본 timeout 5s, 1회 재시도 후 fallback. (`lib/external/withFallback.ts` `withApiFallback` 패턴)
- **캐시**: 동일 좌표/지역 단기예보 등은 메모리/Route 캐시(수 분) 적용해 호출 절감.
- **개인정보**: 외부 API에 개인식별정보 전송 금지(좌표·지역코드 등 비식별 정보만).
- **3유형 fallback 보장**: `USE_SAMPLE_FALLBACK=true` 또는 키 미설정 시 3유형(폭염·집중호우·감염병) 전 흐름이 샘플로 완주되어야 한다.

---

## 2. 연동 후보 API 목록

| # | API | 역할 | 난이도 | MVP 우선순위 | fallback | 상태 |
|---|---|---|---|---|---|---|
| 1 | **주소검색·좌표변환** (카카오 로컬) | 기관등록 시 주소→위경도·행정구역 자동 채움 | 낮음 | **高** | 위경도 수기 입력 + 샘플 주소 좌표 매핑 | **완료** |
| 2 | **기상청 초단기예보 조회서비스** | 기관 좌표 기준 현재 기온/체감/습도 → AI 근거 보강 | 중 | **高** | 샘플 기상값(예: 체감 35℃) | **완료** |
| 3 | **기상청 폭염영향예보 V2** | 폭염 영향 등급/위험수준 → 우선순위 산정 근거 | 중 | 中 | 샘플 영향등급(주의/경고) | **완료** |
| 4 | **행안부 긴급재난문자 API (DSSP-IF-00247)** | 지역 실제 재난문자 자동 수집 — **3유형 유형 분류·필터** | 중~상 | 中 | 샘플 재난문자 3유형 × 3종 | **완료** |
| 5 | **어린이집정보공개포털 cpmsapi030** | 기관 등록 시 상세정보 자동 입력(현원·연령별·교직원·좌표 등) | 상 | **高** | 예시 후보 fallback | **연동 완료** (코드 기반 상세조회. 이름검색=목록API 승인 필요) |
| 6 | **유치원알리미 API** | 유치원 기관 정보 자동 입력 | 상 | 中 | 예시 후보 fallback | 패턴 준비(별도 키 필요) |
| 7 | **문자(SMS) 발송 API** | 역할별 담당자에게 대응계획 링크 발송 | 중 | 中 | 발송 시뮬레이션 | **구조 완료** |
| 8 | **카카오 알림톡 API** | 역할별 담당자 알림톡 발송 | 상 | 中 | SMS fallback → 시뮬레이션 | **구조 완료(채널 승인 필요)** |

> 연동 완료: 1→2→3→4→5→6. 7·8은 구조 구현 완료(키·채널 승인 확보 전 시뮬레이션 fallback).
> 감염병 관련 공공 API(질병관리청 감염병 통계 등)는 **MVP 연동 비필수** — 기관 내 상황 입력과 보건당국 안내문자(행안부 API 경유)로 대체.
> 재난유형은 재난문자 입력 시 **자동 분류**(키워드 + AI 보조, §3.7).

---

## 3. API별 상세

### 3.1 주소검색·좌표변환 (완료)
- **API**: 카카오 로컬 REST API (주소→좌표).
- **역할**: 기관등록 폼에서 주소 입력 → 위도/경도/시도/시군구/행정동 자동 채움.
- **구현**: `lib/external/geocode.ts` + `app/api/external/geocode/route.ts`.
- **엔드포인트**: `GET /api/external/geocode?query=...` → `{ lat, lng, sido, sigungu, dong, source }`.
- **fallback**: `GEOCODE_API_KEY` 미설정 또는 실패 시 샘플 좌표(서울 종로구 기준) 반환.

### 3.2 기상청 초단기예보 (완료)
- **API**: 기상청 초단기실황조회서비스.
- **역할**: 기관 좌표(Lambert 격자 변환) 기준 현재 기온/체감온도/습도 → AI 입력 `weather_context`로 제공. "반영된 근거 정보"에 실데이터 표기.
- **구현**: `lib/external/weather.ts` + `app/api/external/weather/route.ts`.
- **엔드포인트**: `GET /api/external/weather?lat=&lng=` → `{ temp, feelsLike, humidity, time, source }`.
- **유형 파라미터**: `fetchWeatherContext(lat, lng, disasterType?)` — `_disasterType` 옵션 인자 지원(현재 구조 유지, 집중호우 강수 카테고리 확장은 미래 작업).
- **Lambert 변환**: 위경도 → 기상청 격자(nx, ny) 변환 유틸 포함.
- **fallback**: `KMA_API_KEY` 미설정 시 샘플 기상값(기온 20℃, 체감 22℃, 습도 75%) 반환. 감염병 유형에서는 기상청 데이터 불필요(weather_context 미주입).

### 3.3 기상청 폭염영향예보 V2 (완료)
- **API**: `ImpactInfoServiceV2/getHWImpactValueV2` (필수 파라미터: `tm`).
- **역할**: 폭염 영향 등급(관심/주의/경고/위험) → `priority` 산정 근거 보강.
- **구현**: `lib/external/impactForecast.ts` + `app/api/external/weather/impact/route.ts`.
- **엔드포인트**: `GET /api/external/weather/impact?sido=` → `{ level, source }`.
- **fallback**: `KMA_API_KEY` 미설정 시 샘플 영향등급(level: 'medium' / 주의) 반환.
- **적용 유형**: 폭염(heatwave)만. 집중호우·감염병에는 미적용.

### 3.4 행안부 긴급재난문자 API — DSSP-IF-00247 (완료, 3유형 확장)
- **엔드포인트**: `https://www.safetydata.go.kr/V2/api/DSSP-IF-00247`
- **인증**: `serviceKey` 쿼리 파라미터 = env `MOIS_DISASTER_API_KEY` (서버 전용, 클라이언트 노출 금지).
- **역할**: 지역 재난문자 자동 조회 → 재난문자 입력 단계 "실시간 조회" 탭 표시.
- **구현**: `lib/external/disasterSms.ts` + `app/api/external/disaster-sms/route.ts`.
- **엔드포인트(내부)**: `GET /api/external/disaster-sms?sido=&disaster_type=` → `DisasterSmsItem[]` + `source` 메타.

#### 유형 분류 (`classifyDisasterType`)
```typescript
// lib/external/disasterSms.ts
export function classifyDisasterType(item: Record<string, unknown>): DisasterType | 'other'
```
- `DST_SE_NM` 필드 키워드 우선 → `EMRG_STEP_NM` → `MSG_CN` 본문 키워드.
- 폭염: `폭염|고온|열사병|온열`
- 집중호우: `호우|집중호우|침수|강우|홍수|태풍|하천|범람|저지대`
- 감염병: `감염|확진|유행|전파|바이러스|방역|격리|코로나|독감|노로|살모넬라`
- 나머지: `'other'`

#### 함수 시그니처 (확장 완료)
```typescript
export async function fetchRecentDisasterSms(
  sido?: string | null,
  disasterType?: DisasterType | null
): Promise<DisasterSmsItem[]>
```
- `disaster_type` 파라미터로 결과 필터링.
- API 결과에 해당 유형 없으면 해당 유형 샘플 fallback.

#### V2 응답 구조 (2026-06-15 실 검증)
```json
{
  "header": { "resultMsg": "NORMAL SERVICE", "resultCode": "00" },
  "body": [
    {
      "MSG_CN": "...",
      "RCPTN_RGN_NM": "서울특별시",
      "CRT_DT": "2023/09/19 12:22:17",
      "EMRG_STEP_NM": "폭염경보",
      "SN": 205355,
      "DST_SE_NM": "폭염"
    }
  ]
}
```
- `json.body`가 배열 (`json.response.body.items` 구조 아님).
- `SN`은 number 타입. `CRT_DT`는 슬래시 형식(`normalizeDateTime()`으로 ISO 변환).

#### 재난유형별 연동 전략
| 재난유형 | 행안부 재난문자 | 기상청 | 감염병 전용 |
|---|---|---|---|
| 폭염 | 필터: `heatwave` | 초단기예보 + 폭염영향예보 V2 | 해당 없음 |
| 집중호우 | 필터: `heavy_rain` | 초단기예보 (강수 카테고리 확장 예정) | 해당 없음 |
| 감염병 | **옵션** (보건당국 안내문자) | 해당 없음 | 기관 내 상황 입력으로 대체 가능 |

> 감염병: 재난문자 없이 기관 내 유증상 상황 입력만으로 AI 생성 가능(`disaster_message_text` 옵션화). 보건당국 안내문자는 행안부 API를 통해 선택적으로 조회 가능.

### 3.5 / 3.6 어린이집정보공개포털 API (cpmsapi030, 연동 완료 — 코드 기반 상세조회)
- **실 엔드포인트**: `http://api.childcare.go.kr/mediate/rest/cpmsapi030/cpmsapi030/request?key=&arcode=&stcode=` → **XML** 응답.
- **구현**: `lib/external/childcareInfo.ts`(XML 파서·정규화·가이드 탐지) + `app/api/external/childcare/route.ts`.
- **엔드포인트(내부)**: `GET /api/external/childcare?q=&type=&code=&arcode=` → `{ data, source, error }`.
  - `arcode`+`code`(stcode) → cpmsapi030 **실 상세조회 1건**.
  - `q`(이름)만 → 목록 API 필요(아래) → 예시 후보 fallback(`error:'list_api_unavailable'`).
- **응답 필드 케이스 혼재**: 헤더 소문자(`crname`,`crcapat`,`crchcnt`,`la`/`lo`,`crcargbname`,`sigunname`,`craddr` 등) + 카운트 대문자(`CHILD_CNT_00..TOT`,`CLASS_CNT_*`,`EM_CNT_A1..A10`,`EM_CNT_TOT`). 정규화 `pick()`이 대/소/첫자대문자 변형 모두 흡수.
- **파생값**: `infant_total_count`(만0~2+영아혼합), `preschool_total_count`(만3~5+유아혼합), `special_support_count_api`(`CHILD_CNT_SP`). 원본은 `institutions.api_raw` 보존, 사용자 수정 시 `child_count_source='user_corrected'`.
- **역할 자동활성화 근거**: 간호사(`EM_CNT_A6`)/간호조무사(`EM_CNT_A10`)>0→보건, 영양사(`EM_CNT_A5`)/조리원(`EM_CNT_A7`)>0→조리·급식, `crcargbname`=='운영'→통학버스, 특수교사(`EM_CNT_A3`)/특수장애아동(`CHILD_CNT_SP`)>0→특별지원 강화(법적 단정 금지).
- **개인정보**: 개별 유아 이름·진단명 미저장. 특수장애 아동수는 집계값만.

#### 인증키 단계·운영 메모 (2026-06-16 실 검증)
- **현재 키 = 개발 계정 인증키**. 개발키는 `cpmsapi030` 호출 시 **필드 레이아웃 가이드 템플릿**(값 `01`~`62`)을 반환하는 것이 정상 동작. 실데이터는 **운영 계정 인증키**(개발/구축/테스트 완료 후 재심의 승인) 적용 시 제공.
- **개발/구축/테스트 완료 상태**(운영키 신청 전제):
  - 개발: cpmsapi030 클라이언트(XML 파서·정규화·가이드 탐지) — `lib/external/childcareInfo.ts`.
  - 구축: 등록 화면(`/register`)에 이름 검색 + **어린이집 코드(arcode+stcode) 직접 조회** UI 빌드 → `/api/external/childcare` 호출.
  - 테스트: 개발키 라이브 호출(가이드 탐지→fallback) + 합성 실데이터 파싱 12/12 검증.
- 운영키 적용 시 `source:'api'` 실데이터가 그대로 자동 채움(코드 변경 불필요).
- 부가: 이름 검색 실데이터화에는 목록 API(`cpmsapi003`) 활용 신청·승인 별도 필요(현재 개발키도 미승인 INFO-100).
- **유치원알리미**(`KINDERGARTEN_API_KEY`)는 동일 패턴으로 확장 예정(별도 키 필요).

### 3.7 재난유형 자동 분류 (R-series)
- **역할**: 재난문자 원문 → 재난유형(`heatwave`/`heavy_rain`/`infection`) 결정. 수동 선택 단계 폐지.
- **구현**: `app/api/plan/classify/route.ts` — 1차 키워드(`classifyFromText`) → `'other'`면 AI 보조(`lib/ai/classifyDisaster.ts`, max_tokens 8).
- **엔드포인트(내부)**: `POST /api/plan/classify { raw_text }` → `{ disaster_type, source: 'keyword'|'ai'|'none'|'sample' }`.
- **fallback**: `USE_SAMPLE_FALLBACK`/키 미설정 시 AI 보조 생략. `'other'`면 UI에서 수동 선택.

### 3.8 발송 — 문자(SMS) / 카카오 알림톡 (구조 완료, R-series)
- **역할**: 대응계획 공유 링크를 역할별 담당자에게 발송.
- **구현**: `lib/external/notify.ts` + `app/api/plan/[id]/notify/route.ts`.
- **우선순위**: 알림톡(consent_kakao + 키) → 실패/미사용 시 SMS(consent_sms + 키) → 키 미설정/`USE_SAMPLE_FALLBACK` 시 발송 시뮬레이션(`source:'sample'`).
- **게이트**: `institution_staff_contacts`에서 `is_active` + 채널별 수신동의(consent_*)인 담당자만 대상.
- **개인정보**: 발송 본문에 유아 PII 미포함(역할명 + 공유 링크만). 알림톡 실발송은 사업자 채널·발신프로필·템플릿 승인 필요.
- **키**: `KAKAO_ALIMTALK_API_KEY`/`KAKAO_ALIMTALK_SENDER_KEY`, `SMS_API_KEY`/`SMS_API_SENDER`, `APP_BASE_URL`(링크 도메인).

---

## 4. fallback 전략 요약

```
호출 흐름:
  USE_SAMPLE_FALLBACK? ──yes──> 샘플 응답 (source:'sample')
        │ no
        ▼
  키 존재? ──no──> 샘플 응답
        │ yes
        ▼
  외부 호출 (timeout 5s) ──실패/타임아웃──> 1회 재시도 ──실패──> 샘플 응답
        │ 성공
        ▼
  실데이터 응답 (source:'api')
```

#### 3유형별 샘플 데이터 (`lib/sample/disaster_messages.ts`)
| 재난유형 | 샘플 수량 | 비고 |
|---|---|---|
| 폭염 (`heatwave`) | 3종 | 폭염주의보/폭염경보/야외활동 자제 강도별 |
| 집중호우 (`heavy_rain`) | 3종 | 호우경보/호우주의보/강풍 |
| 감염병 (`infection`) | 2종 | 보건당국 안내 (감염병 확진 단정 표현 없음) |

- 재난문자 샘플은 실시간 조회 fallback의 백엔드 원본으로만 사용(화면에 "샘플 선택" UI 없음).
- **핵심 흐름(로그인·자동분류·AI 생성·결과·공유/발송)은 어떤 외부 API 없이도 100% 동작**해야 한다(`USE_SAMPLE_FALLBACK=true` 시 smoke-test 30/30 PASS).

---

## 5. 환경변수 목록 (`.env.local` / Vercel 환경변수)

| 변수 | 용도 | 비고 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API | 서버 전용 |
| `ANTHROPIC_MODEL` | 모델명 | 기본 `claude-haiku-4-5`(고품질 시 `claude-sonnet-4-6`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | 클라이언트 노출 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 | 클라이언트 노출 가능 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 라우트 쓰기/민감 조회 | **절대 클라이언트 노출 금지** |
| `USE_SAMPLE_FALLBACK` | 외부 의존 전면 차단 토글 | `true`/`false` (데모 안전판) |
| `GEOCODE_API_KEY` | 카카오 로컬 주소·좌표 변환 | 서버 전용 |
| `KMA_API_KEY` | 기상청(초단기예보/폭염영향예보 V2) | 서버 전용 |
| `MOIS_DISASTER_API_KEY` | 행안부 긴급재난문자 (DSSP-IF-00247) | 서버 전용 |
| `CHILDCARE_API_KEY` | 어린이집정보공개포털 (R-series 연동) | 서버 전용 |
| `KINDERGARTEN_API_KEY` | 유치원알리미 (R-series 연동) | 서버 전용 |
| `SESSION_SECRET` | 기관 로그인 세션 쿠키 HMAC 서명키 | 서버 전용, 프로덕션 필수 |
| `ADMIN_ACCESS_KEY` | 관리자 접근 키(기관 로그인과 분리) | 서버 전용, 선택 |
| `APP_BASE_URL` | 공유 링크·발송 본문 기본 URL | 선택 |
| `KAKAO_ALIMTALK_API_KEY` / `KAKAO_ALIMTALK_SENDER_KEY` | 카카오 알림톡 발송 | 서버 전용, 선택(채널 승인 필요) |
| `SMS_API_KEY` / `SMS_API_SENDER` | 문자(SMS) 발송 | 서버 전용, 선택 |

> 모든 외부 키는 **미설정 시 자동 샘플/시뮬레이션 모드**로 동작하도록 `lib/env.ts`에서 분기한다(키 없어도 빌드·데모 가능).

---

## 6. 감염병 전용 API 정책

감염병 대응에서 공공 API 자동연동은 **MVP 비필수**로 결정.

**이유:**
- 감염병 의심 단계에서는 재난문자보다 기관 내 유증상 발생 상황이 주 입력.
- 질병관리청 통계 API는 지역 실시간 발생 수 위주 — 기관 현장 대응과 거리가 있음.
- 오진·확진 단정 표현 위험 → AI 입력을 "유증상 집계" 중심으로 한정하는 것이 안전.

**대체 흐름:**
1. 보건당국이 행안부 긴급재난문자로 안내 발송 → 행안부 API 경유 `infection` 분류 후 조회 가능.
2. 기관이 자체 감지한 유증상 상황 → "기관 내 상황 입력" 모드로 재난문자 없이 AI 생성.
3. AI 출력에 항상 "보건당국·의료기관 지시 우선" 문구 삽입.
