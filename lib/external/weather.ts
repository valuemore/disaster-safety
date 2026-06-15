// 기상청 단기예보·초단기예보 서비스 (서버 전용)
// KMA_API_KEY 없거나 실패 시 샘플 데이터 fallback
import { USE_SAMPLE_FALLBACK, KMA_WEATHER_API_KEY } from '@/lib/env'

const TIMEOUT_MS = 5_000

export interface WeatherContext {
  temp: number | null        // 기온(℃)
  feels_like: number | null  // 체감온도(℃) — 기온 + 습도 보정 근사값
  humidity: number | null    // 상대습도(%)
  sky: string | null         // 하늘상태(맑음/구름많음/흐림)
  observed_at: string | null // 발표 기준 시각 (ISO 8601)
  source: 'api' | 'sample'
}

export const SAMPLE_WEATHER: WeatherContext = {
  temp: 34,
  feels_like: 36,
  humidity: 65,
  sky: '맑음',
  observed_at: null,
  source: 'sample',
}

// ── KMA 격자 변환 (Lambert conformal conic) ──────────────────────────────
// 출처: 기상청 오픈 API 활용가이드 부록
function latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
  const RE = 6371.00877
  const GRID = 5.0
  const DEGRAD = Math.PI / 180.0
  const slat1 = 30.0 * DEGRAD
  const slat2 = 60.0 * DEGRAD
  const olon = 126.0 * DEGRAD
  const olat = 38.0 * DEGRAD
  const XO = 43
  const YO = 136

  const re = RE / GRID
  let sn =
    Math.log(Math.cos(slat1) / Math.cos(slat2)) /
    Math.log(
      Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
      Math.tan(Math.PI * 0.25 + slat1 * 0.5)
    )
  let sf = Math.pow(Math.tan(Math.PI * 0.25 + slat1 * 0.5), sn)
  sf = (re * (Math.cos(slat1) / sn)) * sf
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = sf / Math.pow(ro, sn)

  const ra = lat * DEGRAD
  let r = Math.tan(Math.PI * 0.25 + ra * 0.5)
  r = sf / Math.pow(r, sn)

  let theta = lng * DEGRAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn

  return {
    nx: Math.floor(r * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - r * Math.cos(theta) + YO + 0.5),
  }
}

// 초단기예보 base_date/base_time 계산
// 초단기예보는 매 시 45분경 갱신 → 안전하게 1시간 전 데이터 사용
function getBaseDateTime(): { baseDate: string; baseTime: string } {
  const now = new Date()
  const base = new Date(now.getTime() - 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    baseDate: `${base.getFullYear()}${pad(base.getMonth() + 1)}${pad(base.getDate())}`,
    baseTime: `${pad(base.getHours())}00`,
  }
}

// 하늘상태 코드 → 텍스트
const SKY_LABEL: Record<string, string> = {
  '1': '맑음',
  '3': '구름 많음',
  '4': '흐림',
}

// 체감온도 근사 (기온 + 습도 기반 Heat Index, 단순화)
function estimateFeelsLike(temp: number, humidity: number): number {
  // NOAA Heat Index 간소화 버전 (Rothfusz 회귀식 간략화)
  const hi =
    -8.78469475556 +
    1.61139411 * temp +
    2.33854883889 * humidity -
    0.14611605 * temp * humidity -
    0.012308094 * temp * temp -
    0.0164248277778 * humidity * humidity +
    0.002211732 * temp * temp * humidity +
    0.00072546 * temp * humidity * humidity -
    0.000003582 * temp * temp * humidity * humidity
  return Math.round(hi * 10) / 10
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms)),
  ])
}

export async function fetchWeatherContext(
  lat: number | null | undefined,
  lng: number | null | undefined
): Promise<WeatherContext> {
  if (USE_SAMPLE_FALLBACK || !KMA_WEATHER_API_KEY || lat == null || lng == null) {
    return { ...SAMPLE_WEATHER, observed_at: new Date().toISOString() }
  }

  const { nx, ny } = latLngToGrid(lat, lng)
  const { baseDate, baseTime } = getBaseDateTime()

  const params = new URLSearchParams({
    serviceKey: KMA_WEATHER_API_KEY,
    numOfRows: '60',
    pageNo: '1',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  })

  const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst?${params}`

  try {
    const res = await withTimeout(fetch(url), TIMEOUT_MS)
    if (!res.ok) throw new Error(`KMA ${res.status}`)
    const json = await res.json()

    const items: Array<{ category: string; fcstValue: string; fcstTime: string }> =
      json?.response?.body?.items?.item ?? []

    if (items.length === 0) throw new Error('No items')

    // 첫 번째 예보 시각 기준으로 카테고리별 값 추출
    const firstTime = items[0].fcstTime
    const byCategory: Record<string, string> = {}
    for (const item of items) {
      if (item.fcstTime === firstTime) {
        byCategory[item.category] = item.fcstValue
      }
    }

    const temp = byCategory['T1H'] != null ? parseFloat(byCategory['T1H']) : null
    const humidity = byCategory['REH'] != null ? parseFloat(byCategory['REH']) : null
    const sky = SKY_LABEL[byCategory['SKY'] ?? ''] ?? null

    const feelsLike =
      temp != null && humidity != null ? estimateFeelsLike(temp, humidity) : null

    const observedAt = `${baseDate.slice(0, 4)}-${baseDate.slice(4, 6)}-${baseDate.slice(6, 8)}T${baseTime.slice(0, 2)}:${baseTime.slice(2, 4)}:00+09:00`

    return { temp, feels_like: feelsLike, humidity, sky, observed_at: observedAt, source: 'api' }
  } catch (err) {
    console.warn('[weather] fallback:', err)
    return { ...SAMPLE_WEATHER, observed_at: new Date().toISOString() }
  }
}
