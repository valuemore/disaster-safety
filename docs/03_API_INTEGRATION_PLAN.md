# 03_API_INTEGRATION_PLAN — 공공 API 연동 계획

> 방침: 공공 API 연동은 **가산점**이며 **필수가 아니다**. **모든 API는 실패 시 샘플 데이터 모드로 자동 전환**되어야 하고, 데모 흐름은 절대 끊기지 않는다.
> 모든 외부 호출은 **Next.js Server Route(서버)에서만** 수행한다(키 노출 방지, CORS 회피, 캐시·타임아웃 일원화).
> 확정 결정: **가능한 많이 연동**하되, 우선순위에 따라 단계적으로 붙이고 fallback을 먼저 보장한다.
> 최종 갱신: **2026-06-16** (P6 연동 완료 + 3유형 확장 반영)

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
| 5 | **한국사회보장정보원 어린이집 정보 API** | 어린이집 기관 정보 자동 입력 | 상 | 低 | 수기 입력 + 샘플 기관 | MVP 제외 |
| 6 | **한국교육학술정보원 유치원 공시정보 API** | 유치원 기관 정보 자동 입력 | 상 | 低 | 수기 입력 + 샘플 기관 | MVP 제외 |

> 연동 완료: 1→2→3→4. 5·6은 공공데이터포털 신청·승인 지연이 커서 후순위 제외.
> 감염병 관련 공공 API(질병관리청 감염병 통계 등)는 **MVP 연동 비필수** — 기관 내 상황 입력과 보건당국 안내문자(행안부 API 경유)로 대체.

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

### 3.5 / 3.6 어린이집·유치원 정보 API (MVP 제외)
- 신청·승인·키 발급 지연이 커서 MVP 제외. 수기 입력 폼 + 시드 기관으로 충분.

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

- `getSampleMessagesByType(type)` 함수로 유형별 샘플 자동 선택.
- UI는 `source` 메타로 "실데이터/샘플" 배지를 표시(투명성 + 데모 설명).
- **핵심 흐름(AI 생성·결과·사후기록)은 어떤 외부 API 없이도 100% 동작**해야 한다.

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
| `CHILDCARE_API_KEY` | 어린이집 정보(선택, MVP 제외) | 서버 전용 |
| `KINDERGARTEN_API_KEY` | 유치원 공시(선택, MVP 제외) | 서버 전용 |

> 모든 외부 키는 **미설정 시 자동 샘플 모드**로 동작하도록 `lib/env.ts`에서 분기한다(키 없어도 빌드·데모 가능).

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
