# 04_AI_PROMPT_SPEC — AI 프롬프트 명세 (Anthropic Claude)

> 목적: 재난문자(또는 기관 내 상황 입력) + 기관 집계정보 + 현재 상황을 입력받아 **역할별 체크리스트·학부모 안내문·사후기록 초안**을 **JSON으로** 생성한다.
> 제공자: **Anthropic Claude**(기본 `claude-haiku-4-5`, 고품질 필요 시 `claude-sonnet-4-6`). 호출은 **Next.js Server Route**에서 수행.
> 절대 원칙: **개인식별정보 미전송**, **의료 진단 금지**, **공식기관 우선**, **JSON-only 출력**, **실패 시 유형별 샘플 fallback**.
> 지원 재난유형: **폭염(heatwave) · 집중호우(heavy_rain) · 감염병(infection)** — 3종.
> 지원 역할: **원장(director) · 담임교사(homeroom_teacher) · 통학버스담당자(bus_manager) · 조리사/급식담당자(cook_or_food_service) · 보건담당자(health_manager)** — 5종.

---

## 1. AI 파일 구조 (`lib/ai/`)

```
lib/ai/
  systemPrompt.ts        # 공통 system prompt — 재난유형 무관 안전규칙 7개
  buildSystemPrompt.ts   # 공통 + registry[type].policyBlock 조립, OUTPUT_SCHEMA_HINT
  aiPlanSchema.ts        # 공통 출력 스키마 (role_based_actions 배열 기반)
  buildAiInput.ts        # disaster_type 동적, 유형별 profile JSONB 직렬화(화이트리스트)
  callClaude.ts          # 호출 / 1회 재시도 / 유형별 샘플 fallback
  legacyAdapter.ts       # 파생 getter (director_checklist 등 하위 호환)
  disaster/
    heatwave.ts          # 폭염 policy block + output guidance (역할별 가이드)
    heavyRain.ts         # 집중호우 policy block + output guidance
    infection.ts         # 감염병 policy block + output guidance + 추가 안전규칙
```

---

## 2. AI 입력 JSON 구조 (서버가 구성하여 전달)

> 입력은 **화이트리스트 필드만** 직렬화한다. 이름/진단명/약물명/연락처 등은 스키마상 존재하지 않으므로 원천적으로 포함될 수 없다.

### 2.1 폭염 입력 예시

```json
{
  "disaster_type": "heatwave",
  "disaster_message": {
    "raw_text": "오늘 14시 기준 폭염경보 발효. 야외활동을 자제하고 충분한 수분을 섭취하세요.",
    "source": "sample",
    "issued_at": "2026-06-15T14:00:00+09:00"
  },
  "institution": {
    "type": "daycare",
    "sido": "서울특별시",
    "sigungu": "강서구",
    "total_children": 80,
    "infant_count": 20,
    "toddler_count": 60,
    "staff_count": 14,
    "has_shuttle": true,
    "has_outdoor_playground": true,
    "cooling_space_count": 5,
    "water_available": true
  },
  "heatwave_profile": {
    "heat_vulnerable_count": 3,
    "respiratory_caution_count": 2,
    "mobility_support_count": 1,
    "special_support_count": 1,
    "cooling_ok": true,
    "indoor_alt_space": true,
    "water_supply_ok": true,
    "thermometer": true,
    "first_aid_kit": true,
    "vehicle_thermometer": false,
    "pickup_wait_place": "indoor"
  },
  "selected_situations": ["outdoor_during", "heat_symptom"],
  "situation_etc": null,
  "weather_context": { "temp": 34, "feels_like": 36, "source": "sample" }
}
```

### 2.2 집중호우 입력 예시

```json
{
  "disaster_type": "heavy_rain",
  "disaster_message": {
    "raw_text": "[기상청] 호우경보 발효. 저지대·지하공간 침수 위험. 위급 시 119.",
    "source": "sample",
    "issued_at": "2026-06-15T13:00:00+09:00"
  },
  "institution": { "...기관 공통 필드..." },
  "heavy_rain_profile": {
    "is_low_ground": true,
    "near_river_or_slope": false,
    "has_underground_space": true,
    "first_floor_entrance_type": "flat",
    "pickup_waiting_area": "indoor",
    "has_bus": true,
    "indoor_waiting_space": true,
    "evacuation_space": "2층 강당"
  },
  "selected_situations": ["pickup_ready", "bus_before", "underground_in_use"],
  "situation_etc": null
}
```

### 2.3 감염병 입력 예시 (재난문자 없이 상황만)

```json
{
  "disaster_type": "infection",
  "disaster_message": null,
  "institution": { "...기관 공통 필드..." },
  "infection_profile": {
    "has_health_room": true,
    "has_thermometer": true,
    "has_sanitizer_and_mask": true,
    "has_infection_manual": true,
    "has_infant_class": false
  },
  "selected_situations": ["fever_symptom", "parent_contact_needed", "classroom_disinfection"],
  "situation_etc": null
}
```

- `disaster_message`는 감염병에서 `null` 허용 (재난문자 없이 기관 내 상황만으로 AI 생성 가능).
- `weather_context`는 폭염/집중호우에서 공공 API 연동 시 실데이터, 미연동/실패 시 샘플. 감염병은 해당 없음.
- `selected_situations`는 재난유형별 코드값(11 문서 §6) 최대 3개.

---

## 3. AI 출력 JSON 스키마 (공통 — `lib/ai/aiPlanSchema.ts`)

```json
{
  "disaster_type": "heatwave | heavy_rain | infection",
  "disaster_summary": "재난문자/상황 핵심 요약(1~3문장)",
  "priority": "high | medium | low",
  "priority_reason": "우선순위 판단 근거(1~2문장)",
  "reflected_evidence": ["반영된 근거 정보(최소 1개)"],
  "missing_info": ["더 나은 대응에 필요한 부족 정보"],
  "role_based_actions": [
    {
      "role": "director | homeroom_teacher | bus_manager | cook_or_food_service | health_manager",
      "role_label": "역할 한국어 표시 이름",
      "actions": ["실행 항목(최소 1개, 해당 인력 없으면 ['해당 없음'])"]
    }
  ],
  "parent_notice": "학부모 안내문(공포 금지, 안정감, 구체 행동, 특정 개인 지목 금지)",
  "after_action_draft": {
    "checked_items": {
      "항목키": "null 또는 권고 메모"
    },
    "notes": "특이사항 초안(개인식별정보 금지)",
    "improvement": "개선 필요사항 초안"
  },
  "emergency_contact_guide": "응급 연락 안내(119 등 공식 채널 우선)",
  "official_priority_notice": "공식기관 지시 우선 안내문",
  "safety_disclaimer": "공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다."
}
```

> **레거시 하위 호환**: `director_checklist`, `teacher_checklist`, `shuttle_checklist` 3개 필드는 `optional`로 유지. `lib/ai/legacyAdapter.ts`의 `ensureLegacyChecklists()`가 `role_based_actions`로부터 자동 파생하여 항상 보장.

- **검증**: 서버에서 **zod 스키마**(`AiPlanSchema`)로 파싱·검증.
- `role_based_actions` 배열은 최소 1개 이상. `actions`는 빈 배열 허용("해당 없음" 처리).
- `safety_disclaimer`는 항상 고정 문구를 서버에서 강제 주입·덮어쓰기.
- `after_action_draft.checked_items`는 재난유형별 동적 키-값 (`z.record(z.string(), z.string().nullable())`).

---

## 4. 공통 시스템 프롬프트 (`lib/ai/systemPrompt.ts`)

```
당신은 한국의 유아교육기관(어린이집·유치원) 재난대응을 지원하는 보조 도구입니다.
입력으로 받은 '공식 재난문자(또는 기관 내 상황 입력)', '기관 집계정보', '대응 프로필(숫자 집계값)', '현재 상황'만을
근거로, 원장·담임교사·통학버스 담당자 등이 즉시 실행할 수 있는 구체적 행동을 한국어로 생성합니다.

반드시 지킬 규칙:
1) 출력은 지정된 JSON 객체 하나만 출력합니다. JSON 외의 설명, 마크다운, 코드블록 표시를 절대 포함하지 않습니다.
2) 의료 진단, 질병명 확정, 약물 권고를 하지 않습니다. 건강 이상이 의심되면 '그늘/실내 이동, 수분, 체온 확인, 필요 시 119' 수준의 일반 안전 행동만 안내합니다. 감염 증상의 경우 진단·확진을 단정하지 않고 보건당국·의료기관을 우선 안내합니다.
3) 당신의 안내가 공식기관(지자체·소방·기상청·보건당국·질병관리청) 지시보다 우선한다고 표현하지 않습니다. 항상 공식 지시와 119를 우선하도록 안내합니다.
4) 학부모 안내문은 과도한 공포·불안을 조장하지 않고, 특정 개인을 지목하지 않으며, 기관이 이미 적절히 조치 중임을 전제로 안정감을 주고, 보호자가 할 구체 행동을 포함합니다.
5) 개인을 식별하는 정보(이름, 진단명, 약물명, 연락처)를 만들어내거나 요구하지 않습니다.
6) 입력에 없는 사실을 지어내지 않습니다. 부족하면 missing_info에 적습니다.
7) 'reflected_evidence'에는 실제로 반영한 입력 항목을 구체적으로 적어 입력→결과의 연결을 드러냅니다.
```

이후 `buildSystemPrompt(disasterType)`에 의해 유형별 policy block이 결합되어 완전한 시스템 프롬프트가 조립된다.

---

## 5. 재난유형별 Policy Block

### 5.1 폭염 (`lib/ai/disaster/heatwave.ts`)

**핵심 지침**:
- 실외활동 중단·실내 전환 최우선.
- 냉방 확인, 충분한 수분 제공, 온열취약 유아 관찰 필수.
- 통학버스 내부 온도 확인·환기.
- 온열증상(얼굴 홍조·무기력·의식 저하) 의심 시 그늘/실내 이동, 체온 확인, 위급 시 119. 의료 진단 금지.
- 식재료 냉장 보관, 조리실 온도·환기 확인 포함(해당 시).

**역할별 출력 가이드**:
- 원장: 전반 지휘, 학부모 안내 발송 결정, 냉방·시설 점검 지시, 실외일정 취소 판단.
- 담임교사: 실내 전환 인솔, 수분 제공, 온열증상 의심 유아 관찰·체온 확인·보고.
- 통학버스 담당자: 차량 내부 온도 확인·환기·에어컨 가동, 탑승 전 좌석 온도 점검, 인원 확인.
- 조리사/급식담당자: 식재료 냉장 보관, 조리실 온도·환기, 식중독 예방, 배식 전 식재료 상태 확인.
- 보건담당자: 온열증상 유아 관찰, 체온 측정, 시원한 공간 이동, 119 연락 기준 안내.

### 5.2 집중호우 (`lib/ai/disaster/heavyRain.ts`)

**핵심 지침**:
- 실외활동 즉시 중단·실내 대기 최우선.
- 지하공간(지하층·반지하) 사용 중지·지상 이동.
- 창문·출입구 주변 누수 확인, 낙수·배수 상태 점검.
- 기관 주변 침수 우려 시 하원 조정 여부 원장 판단, 필요 시 지자체·119 연락.
- 통학버스 운행 전 경로 침수 확인, 침수 구간 운행 보류·우회 경로 확인.
- 침수·정전·고립 위급상황 시 즉시 지자체·119·112 신고. AI는 침수 위험을 예측·단정하지 않음.
- 정전 발생 시 식재료 냉장 상태 확인, 급식 제공 가능 여부 판단.

**역할별 출력 가이드**:
- 원장: 실외활동 중단 지시, 지하공간 사용 중지, 하원 조정·학부모 안내, 지자체·119 연락 판단.
- 담임교사: 실내 대피 인솔, 인원 확인, 창문·출입구 누수 확인, 아동 불안 반응 관찰 및 안정.
- 통학버스 담당자: 경로 침수 확인, 침수 구간 운행 보류·우회, 운행 중 이상 시 즉시 정차·119 신고.
- 조리사/급식담당자: 정전·누수 시 식재료 냉장 상태 확인, 급식 제공 가능 여부 판단·보고.
- 보건담당자: 낙상·저체온·불안 반응 관찰, 이상 유아 보호자 연락·119 연락 기준 안내.

### 5.3 감염병 (`lib/ai/disaster/infection.ts`) — 추가 안전규칙

**핵심 지침**:
- AI는 질병명을 확정하거나 의료 진단을 하지 않음. 기관 운영 조치(분리대기·보호자 연락·소독 등)만 안내.
- "확진"은 사용자가 명시적으로 입력한 경우에만 반영. AI 자체적으로 확진 판단·단정 금지.
- 보건당국 안내문자의 질병명은 "유행 주의 안내" 맥락으로만 인용. 기관 내 특정 유아 개별 확진으로 확대 금지.
- 보건당국(관할 보건소·질병관리청)·의료기관·기관 감염병 대응 매뉴얼을 AI 안내보다 최우선.
- 유증상 유아 즉시 분리대기, 보호자 귀가 안내를 체크리스트에 포함.
- 학부모 안내문: 특정 유아 지목 금지, 익명·집합 표현 사용, 공포·낙인 금지.
- 손위생·환기·소독·급식 위생 강화 등 예방 행동 구체적 포함.
- 조리종사자 유증상 시 즉시 업무 분리 권고(의료 진단 아님, 예방 조치).

**역할별 출력 가이드**:
- 원장: 분리대기 공간 지정·지시, 보호자 귀가 안내 결정, 감염병 매뉴얼 발동, 보건당국 보고 여부 판단, 등원중지 안내문·학부모 전체 안내문 발송 결정.
- 담임교사: 유증상 유아 발견·보고·분리 인솔, 같은 반 증상 관찰·기록, 교실 환기, 손위생 지도.
- 통학버스 담당자: 승·하차 시 유증상 유아 탑승 여부 확인, 차내 환기, 손소독제 비치 확인.
- 조리사/급식담당자: 조리종사자 유증상 시 업무 분리·보고, 손위생, 식기·조리기구 소독 강화, 교차오염 방지.
- 보건담당자: 유증상 유아 분리대기 안내, 체온 측정(진단 아님), 증상 관찰·기록, 보호자 연락 안내, 보건당국·119 연락 기준 안내. 의료 진단·치료 표현 금지.

---

## 6. 금지 표현 (Hard Constraints)

**공통 금지**:
- 의료 진단/질병 단정: "열사병입니다", "탈수입니다" 등 → 금지.
- 약물·복용 권고: 특정 약물명/투약 안내 → 금지.
- 공포 조장: "큰일납니다", "위험천만" 등 과장 → 금지.
- 우선권 침해: "본 안내를 우선하세요", "공식 안내보다…" → 금지.
- 개인정보 요구/생성: 이름·연락처·진단명·약물명 → 금지.
- 단정적 의학 판단/책임 회피 누락: 항상 119·공식기관 우선 문구 유지.

**감염병 추가 금지**:
- 질병명 확정·확진 단정: AI 자체적으로 "A바이러스 감염입니다", "확진입니다" → 금지.
- 특정 유아 지목: "○○ 어린이는" → 금지. 익명·집합 표현 사용.
- 낙인·공포 조장: "집단 감염", "위험한 유아" 등 → 금지.

---

## 7. JSON 파싱 실패 대응 (서버 처리 순서)

```
1) Claude 호출 → 응답 텍스트 수신
2) JSON 파싱 시도 (코드블록/잡텍스트 제거 후 첫 '{'~마지막 '}' 추출)
3) zod 스키마 검증 (AiPlanSchema)
   - 성공 → result_json 저장, is_fallback=false
   - 실패 → 4)
4) 1회 재시도: "직전 출력이 스키마를 위반했습니다. 지정 JSON만 다시 출력하세요." 메시지로 재요청
5) 재시도도 실패 → 해당 재난유형 샘플 결과(fallback) 반환, is_fallback=true, UI에 '샘플 결과' 배지 + 안내
   - heatwave → lib/sample/action_results.ts SAMPLE_AI_RESULT
   - heavy_rain → lib/sample/results/heavyRain.ts SAMPLE_HEAVY_RAIN_AI_RESULT
   - infection → lib/sample/results/infection.ts SAMPLE_INFECTION_AI_RESULT
6) safety_disclaimer는 항상 고정 문구로 서버에서 보장(덮어쓰기)
```

- 타임아웃(12s) 초과 시에도 즉시 5)의 유형별 fallback으로 전환.
- `USE_SAMPLE_FALLBACK=true` 또는 `ANTHROPIC_API_KEY` 미설정 시 즉시 샘플 반환.
- 모든 경로에서 **결과 화면은 정상 렌더**된다(데모 무중단).

---

## 8. 하위 호환 (`lib/ai/legacyAdapter.ts`)

`role_based_actions` 기반 신구조로의 전환 후에도 기존 소비처가 `director_checklist` 등 3개 필드를 직접 읽는 경우 항상 값이 있도록 파생 getter를 제공한다.

```typescript
// role_based_actions에서 특정 역할의 actions 추출
export function getActionsByRole(result: AiPlanResult, roleKey: RoleKey): string[]

// role_based_actions → 레거시 3개 필드 파생 (소비처 하위 호환)
export function ensureLegacyChecklists(result: AiPlanResult): AiPlanResult
// 매핑: director_checklist ← director, teacher_checklist ← homeroom_teacher, shuttle_checklist ← bus_manager
```

---

## 9. 샘플 입력 / 출력 (폭염 시나리오)

### 9.1 샘플 입력
(§2.1의 JSON 예시 — 폭염경보 + 실외놀이 중 + 온열증상 의심, 통학버스 운영, 차량 온도계 미보유)

### 9.2 샘플 출력 (fallback로도 사용)

```json
{
  "disaster_type": "heatwave",
  "disaster_summary": "오후 2시 기준 폭염경보가 발효되어 야외활동 자제와 충분한 수분 섭취가 필요합니다.",
  "priority": "high",
  "priority_reason": "폭염경보 발효, 현재 실외놀이 진행 중이며 온열증상 의심 유아 가능성이 보고되어 즉시 조치가 필요합니다.",
  "reflected_evidence": [
    "재난문자: 폭염경보 발효",
    "현재 상황: 실외놀이 중, 온열증상 의심 유아 있음",
    "프로필: 온열취약 유아 3명, 호흡기 주의 2명",
    "기상: 체감온도 약 36도",
    "시설: 냉방 가능 공간 5곳, 실내 대체공간 있음, 차량 내부 온도계 미보유"
  ],
  "missing_info": [
    "의심 유아의 현재 체온 측정값",
    "냉방기 가동 상태 최신 점검 여부"
  ],
  "role_based_actions": [
    {
      "role": "director",
      "role_label": "원장",
      "actions": [
        "즉시 실외놀이를 중단하고 전 학급을 냉방 가능한 실내로 이동시키도록 지시합니다.",
        "온열증상 의심 유아를 그늘·실내로 옮기고 체온을 확인하도록 담임에게 지시합니다. 위급 시 119에 연락합니다.",
        "냉방 가능 공간 5곳의 가동 상태와 정수기 급수를 점검합니다.",
        "오늘 실외 일정을 취소 또는 연기합니다.",
        "학부모 안내문 발송을 승인하고 하원 동선을 실내 대기로 조정합니다."
      ]
    },
    {
      "role": "homeroom_teacher",
      "role_label": "담임교사",
      "actions": [
        "실외놀이를 즉시 종료하고 유아를 실내 냉방 공간으로 인솔합니다.",
        "유아에게 물을 충분히 제공하고 휴식을 취하게 합니다.",
        "온열증상 의심 유아는 그늘·실내로 옮기고 체온계로 체온을 확인합니다. 상태가 나빠지면 즉시 원장에게 보고하고 119 안내를 따릅니다.",
        "유아 컨디션을 주기적으로 관찰합니다.",
        "활동을 실내 대체활동으로 전환합니다."
      ]
    },
    {
      "role": "bus_manager",
      "role_label": "통학버스 담당자",
      "actions": [
        "운행 전 차량 내부를 충분히 환기하고 에어컨을 미리 가동합니다.",
        "차량 내부 온도계가 없으므로 탑승 전 실내 온도가 충분히 낮아졌는지 손으로 확인하고 좌석 온도를 점검합니다.",
        "탑승·하차 시 인원수를 확인하고 차량 내 잔류 유아가 없는지 좌석을 끝까지 점검합니다.",
        "이동 중 유아에게 물을 제공하고 직사광선이 닿는 좌석을 가립니다.",
        "하차 후 대기는 실내에서 진행합니다."
      ]
    },
    {
      "role": "cook_or_food_service",
      "role_label": "조리사/급식담당자",
      "actions": [
        "식재료를 냉장 보관하고 냉장고 온도를 점검합니다.",
        "조리실 온도를 확인하고 환기를 실시합니다.",
        "배식 전 식재료 상태를 확인하고 식중독 예방 위생 수칙을 준수합니다."
      ]
    },
    {
      "role": "health_manager",
      "role_label": "보건담당자",
      "actions": [
        "온열증상 의심 유아를 시원한 공간으로 이동시키고 체온을 확인합니다.",
        "의식 저하·경련 등 위급 증상 발생 시 즉시 119에 연락합니다.",
        "구급함 위치와 기본 구급 물품을 확인합니다."
      ]
    }
  ],
  "parent_notice": "안녕하세요. 오늘 폭염경보가 발효되어 우리 기관은 실외활동을 중단하고 모든 유아를 시원한 실내에서 보호하며 충분한 수분을 제공하고 있습니다. 가정에서는 등원 시 물병과 가벼운 옷차림을 준비해 주시고, 하원 시간과 실내 대기 장소를 확인해 주세요. 아이의 컨디션에 평소와 다른 점이 있으면 등원 시 교사에게 알려 주시면 함께 살피겠습니다. 아이들의 안전을 최우선으로 돌보겠습니다.",
  "after_action_draft": {
    "checked_items": {
      "outdoor_adjusted": "실외놀이 중단 및 실내 대체활동 전환 완료",
      "cooling_checked": "냉방 공간 가동 및 급수 점검 완료",
      "child_health_issue": "온열증상 의심 유아 관찰 및 체온 확인 진행",
      "parents_notified": "학부모 안내문 발송 예정/완료",
      "shuttle_checked": "차량 환기·온도 점검 후 운행"
    },
    "notes": "차량 내부 온도계 미보유로 수동 확인으로 대체함.",
    "improvement": "차량 내부 온도계 비치 검토 필요."
  },
  "emergency_contact_guide": "유아가 의식 저하, 경련, 심한 무기력 등 위급 증상을 보이면 즉시 119에 신고하고 그늘·시원한 곳으로 옮겨 체온을 낮춥니다. 보건소·지자체 폭염 안내도 함께 참고합니다.",
  "official_priority_notice": "본 안내는 기관의 신속한 대응을 돕기 위한 보조 정보입니다. 지자체·소방·기상청 등 공식기관의 지시가 있으면 그 지시를 우선합니다.",
  "safety_disclaimer": "공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다."
}
```

> 집중호우·감염병 샘플 출력은 `lib/sample/results/heavyRain.ts`, `lib/sample/results/infection.ts` 참조.
> 이 샘플 출력은 (a) AI 정상 출력의 형태 기준이자 (b) 파싱 실패/오프라인 시 **폭염 fallback 결과**로 그대로 사용된다.
