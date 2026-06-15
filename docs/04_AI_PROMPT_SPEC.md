# 04_AI_PROMPT_SPEC — AI 프롬프트 명세 (Anthropic Claude)

> 목적: 재난문자 + 기관 집계정보 + 현재 상황을 입력받아 **역할별 체크리스트·학부모 안내문·사후기록 초안**을 **JSON으로** 생성한다.
> 제공자: **Anthropic Claude**(기본 `claude-haiku-4-5`, 고품질 필요 시 `claude-sonnet-4-6`). 호출은 **Next.js Server Route**에서 수행.
> 절대 원칙: **개인식별정보 미전송**, **의료 진단 금지**, **공식기관 우선**, **JSON-only 출력**, **실패 시 샘플 fallback**.

---

## 1. AI 입력 JSON 구조 (서버가 구성하여 전달)

> 입력은 **화이트리스트 필드만** 직렬화한다. 이름/진단명/약물명/연락처 등은 스키마상 존재하지 않으므로 원천적으로 포함될 수 없다.

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
  "selected_situations": ["during_outdoor", "heat_symptom_suspected"],
  "situation_etc": null,
  "weather_context": { "temp": 34, "feels_like": 36, "source": "sample" }
}
```

- `weather_context`는 공공 API 연동 시 실데이터, 미연동/실패 시 샘플(03 문서). 없을 수도 있음(optional).
- `selected_situations`는 코드값(02 문서 §3) 최대 3개.

---

## 2. AI 출력 JSON 스키마 (필수 — 6.6 전 항목)

```json
{
  "disaster_summary": "string — 재난문자 핵심 요약(1~3문장)",
  "priority": "high | medium | low",
  "priority_reason": "string — 우선순위 판단 근거(간단)",
  "reflected_evidence": ["string — 결과에 반영된 근거 정보(기관/프로필/상황/기상)"],
  "missing_info": ["string — 더 나은 대응을 위해 부족한 정보"],
  "director_checklist": ["string — 원장용 실행 항목"],
  "teacher_checklist": ["string — 담임교사용 실행 항목"],
  "shuttle_checklist": ["string — 통학버스 담당자용 실행 항목"],
  "parent_notice": "string — 학부모 안내문(공포 표현 금지, 조치 중 안정감, 구체 행동 포함)",
  "after_action_draft": {
    "outdoor_adjusted": "string|null — 권고 메모",
    "cooling_checked": "string|null",
    "child_health_issue": "string|null",
    "parents_notified": "string|null",
    "shuttle_checked": "string|null",
    "notes": "string — 특이사항 초안(개인식별정보 금지)",
    "improvement": "string — 개선 필요사항 초안"
  },
  "emergency_contact_guide": "string — 응급 연락 안내(119 등 공식 채널 우선)",
  "official_priority_notice": "string — 공식기관 지시 우선 안내문(고정 취지)",
  "safety_disclaimer": "공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다."
}
```

- **검증**: 서버에서 **zod 스키마**로 파싱·검증. 모든 배열 필드는 최소 1개 이상.
- `safety_disclaimer`는 항상 고정 문구를 포함(모델이 변형하지 않도록 서버에서 강제 주입/덮어쓰기 가능).
- 통학버스 미운영 기관(`has_shuttle:false`)이면 `shuttle_checklist`는 "해당 없음" 1항목으로 처리.

---

## 3. 시스템 프롬프트 초안

```
당신은 한국의 유아교육기관(어린이집·유치원) 폭염 재난대응을 지원하는 보조 도구입니다.
입력으로 받은 '공식 재난문자', '기관 집계정보', '폭염 대응 프로필(숫자 집계값)', '현재 상황'만을
근거로, 원장·담임교사·통학버스 담당자가 즉시 실행할 수 있는 구체적 행동을 한국어로 생성합니다.

반드시 지킬 규칙:
1) 출력은 지정된 JSON 객체 하나만 출력합니다. JSON 외의 설명, 마크다운, 코드블록 표시를 절대 포함하지 않습니다.
2) 의료 진단, 질병명 단정, 약물 권고를 하지 않습니다. 건강 이상이 의심되면 '그늘/실내 이동, 수분, 체온 확인, 필요 시 119' 수준의 일반 안전 행동만 안내합니다.
3) 당신의 안내가 공식기관(지자체·소방·기상청) 지시보다 우선한다고 표현하지 않습니다. 항상 공식 지시와 119를 우선하도록 안내합니다.
4) 학부모 안내문은 과도한 공포·불안을 조장하지 않고, 기관이 이미 적절히 조치 중임을 전제로 안정감을 주며, 보호자가 할 구체 행동(물병 지참, 가벼운 옷, 하원 시간/장소 확인, 컨디션 공유 등)을 포함합니다.
5) 개인을 식별하는 정보(이름, 진단명, 약물명, 연락처)를 만들어내거나 요구하지 않습니다.
6) 입력에 없는 사실을 지어내지 않습니다. 부족하면 missing_info에 적습니다.
7) 'reflected_evidence'에는 실제로 반영한 입력 항목(예: 폭염경보, 실외놀이 중, 온열취약 3명, 체감 36도)을 구체적으로 적어 입력→결과의 연결을 드러냅니다.

JSON 스키마(키와 타입)는 사용자 메시지에서 지정한 형식을 정확히 따릅니다.
```

> 구현 팁(Anthropic): 가능하면 **tool use(structured output)** 또는 명시적 스키마 + `assistant` 응답 prefill(`{`)로 JSON-only를 강제한다. 시스템/도구 정의로 형식을 강하게 고정하는 것이 파싱 안정성에 유리.

---

## 4. 금지 표현 (Hard Constraints)
- 의료 진단/질병 단정: "열사병입니다", "탈수입니다" 등 → 금지.
- 약물·복용 권고: 특정 약물명/투약 안내 → 금지.
- 공포 조장: "큰일납니다", "위험천만" 등 과장 → 금지.
- 우선권 침해: "본 안내를 우선하세요", "공식 안내보다…" → 금지.
- 개인정보 요구/생성: 이름·연락처·진단명·약물명 → 금지.
- 단정적 의학 판단/책임 회피 누락: 항상 119·공식기관 우선 문구 유지.

---

## 5. JSON 파싱 실패 대응 (서버 처리 순서)

```
1) Claude 호출 → 응답 텍스트 수신
2) JSON 파싱 시도 (코드블록/잡텍스트 제거 후 첫 '{'~마지막 '}' 추출)
3) zod 스키마 검증
   - 성공 → result_json 저장, is_fallback=false
   - 실패 → 4)
4) 1회 재시도: "직전 출력이 스키마를 위반했습니다. 지정 JSON만 다시 출력하세요." 메시지로 재요청
5) 재시도도 실패 → 샘플 결과(fallback) 반환, is_fallback=true, UI에 '샘플 결과' 배지 + 안내
6) safety_disclaimer는 항상 고정 문구로 서버에서 보장(덮어쓰기)
```
- 타임아웃(예: 12s) 초과 시에도 즉시 5)의 fallback으로 전환.
- 모든 경로에서 **결과 화면은 정상 렌더**된다(데모 무중단).

---

## 6. 샘플 입력 / 출력 (폭염 시나리오 1세트)

### 6.1 샘플 입력
(위 §1의 JSON 예시 — 폭염경보 + 실외놀이 중 + 온열증상 의심, 통학버스 운영, 차량 온도계 미보유)

### 6.2 샘플 출력 (fallback로도 사용)
```json
{
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
  "director_checklist": [
    "즉시 실외놀이를 중단하고 전 학급을 냉방 가능한 실내로 이동시키도록 지시합니다.",
    "온열증상 의심 유아를 그늘·실내로 옮기고 체온을 확인하도록 담임에게 지시합니다. 의식 저하 등 위급 시 119에 연락합니다.",
    "냉방 가능 공간 5곳의 가동 상태와 정수기 급수를 점검합니다.",
    "오늘 실외 일정(산책·현장학습)을 취소 또는 연기합니다.",
    "학부모 안내문 발송을 승인하고 하원 동선을 실내 대기로 조정합니다."
  ],
  "teacher_checklist": [
    "실외놀이를 즉시 종료하고 유아를 실내 냉방 공간으로 인솔합니다.",
    "유아에게 물을 충분히 제공하고 휴식을 취하게 합니다.",
    "온열증상 의심 유아는 그늘·실내로 옮기고 체온계로 체온을 확인합니다. 상태가 나빠지면 즉시 원장에게 보고하고 119 안내를 따릅니다.",
    "유아 컨디션(얼굴 홍조, 무기력 등)을 주기적으로 관찰합니다.",
    "활동을 실내 대체활동으로 전환합니다."
  ],
  "shuttle_checklist": [
    "운행 전 차량 내부를 충분히 환기하고 에어컨을 미리 가동합니다.",
    "차량 내부 온도계가 없으므로 탑승 전 실내 온도가 충분히 낮아졌는지 손으로 확인하고 좌석 온도를 점검합니다.",
    "탑승·하차 시 인원수를 확인하고 차량 내 잔류 유아가 없는지 좌석을 끝까지 점검합니다.",
    "이동 중 유아에게 물을 제공하고 직사광선이 닿는 좌석을 가립니다.",
    "하차 후 대기는 실내에서 진행합니다."
  ],
  "parent_notice": "안녕하세요. 오늘 폭염경보가 발효되어 우리 기관은 실외활동을 중단하고 모든 유아를 시원한 실내에서 보호하며 충분한 수분을 제공하고 있습니다. 가정에서는 등원 시 물병과 가벼운 옷차림을 준비해 주시고, 하원 시간과 실내 대기 장소를 확인해 주세요. 아이의 컨디션에 평소와 다른 점이 있으면 등원 시 교사에게 알려 주시면 함께 살피겠습니다. 아이들의 안전을 최우선으로 돌보겠습니다.",
  "after_action_draft": {
    "outdoor_adjusted": "실외놀이 중단 및 실내 대체활동 전환 완료",
    "cooling_checked": "냉방 공간 가동 및 급수 점검 완료",
    "child_health_issue": "온열증상 의심 유아 관찰 및 체온 확인 진행",
    "parents_notified": "학부모 안내문 발송 예정/완료",
    "shuttle_checked": "차량 환기·온도 점검 후 운행",
    "notes": "차량 내부 온도계 미보유로 수동 확인으로 대체함.",
    "improvement": "차량 내부 온도계 비치 검토 필요."
  },
  "emergency_contact_guide": "유아가 의식 저하, 경련, 심한 무기력 등 위급 증상을 보이면 즉시 119에 신고하고 그늘·시원한 곳으로 옮겨 체온을 낮춥니다. 보건소·지자체 폭염 안내도 함께 참고합니다.",
  "official_priority_notice": "본 안내는 기관의 신속한 대응을 돕기 위한 보조 정보입니다. 지자체·소방·기상청 등 공식기관의 지시가 있으면 그 지시를 우선합니다.",
  "safety_disclaimer": "공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다."
}
```

> 이 샘플 출력은 (a) AI 정상 출력의 형태 기준이자 (b) 파싱 실패/오프라인 시 **fallback 결과**로 그대로 사용된다. `02_DB_SCHEMA.md`의 시드 및 데모 시나리오와 일치시킨다.
