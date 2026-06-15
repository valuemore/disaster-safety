// 기상청 폭염 영향예보 서비스 (서버 전용)
// KMA_API_KEY 없거나 실패 시 샘플 데이터 fallback
import { USE_SAMPLE_FALLBACK, KMA_API_KEY } from '@/lib/env'

const TIMEOUT_MS = 5_000

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ImpactForecast {
  level: ImpactLevel       // 영향 수준: low(관심)/medium(주의)/high(경고)/critical(위험)
  label: string            // 한국어 레이블
  description: string      // 영향 설명
  valid_date: string | null // 예보 날짜 (YYYYMMDD)
  source: 'api' | 'sample'
}

export const SAMPLE_IMPACT: ImpactForecast = {
  level: 'high',
  label: '경고',
  description: '폭염으로 인한 건강 피해 발생 가능성이 높습니다. 취약계층 집중 관리가 필요합니다.',
  valid_date: null,
  source: 'sample',
}

// 기상청 영향예보 등급 코드 → 내부 레벨 매핑
const LEVEL_MAP: Record<string, ImpactLevel> = {
  '관심': 'low',
  '주의': 'medium',
  '경고': 'high',
  '위험': 'critical',
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms)),
  ])
}

export async function fetchImpactForecast(sido?: string | null): Promise<ImpactForecast> {
  if (USE_SAMPLE_FALLBACK || !KMA_API_KEY) {
    return { ...SAMPLE_IMPACT, valid_date: new Date().toISOString().slice(0, 10).replace(/-/g, '') }
  }

  // 기상청 영향예보 API (폭염)
  // https://apis.data.go.kr/1360000/HeatWaveLifeIndex/getHeatWaveLifeIndex
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`

  const params = new URLSearchParams({
    serviceKey: KMA_API_KEY,
    numOfRows: '10',
    pageNo: '1',
    dataType: 'JSON',
    date: dateStr,
  })

  const url = `https://apis.data.go.kr/1360000/HeatWaveLifeIndex/getHeatWaveLifeIndex?${params}`

  try {
    const res = await withTimeout(fetch(url), TIMEOUT_MS)
    if (!res.ok) throw new Error(`KMA impact ${res.status}`)
    const json = await res.json()

    const items: Array<{ areaName: string; heatLevel: string; date: string }> =
      json?.response?.body?.items?.item ?? []

    if (items.length === 0) throw new Error('No items')

    // sido가 있으면 해당 지역 우선, 없으면 전국 최고 수준
    const target = sido
      ? items.find((i) => i.areaName?.includes(sido.replace('특별시', '').replace('광역시', '').replace('특별자치시', '').trim()))
      : null
    const item = target ?? items[0]

    const level: ImpactLevel = LEVEL_MAP[item.heatLevel] ?? 'medium'
    return {
      level,
      label: item.heatLevel,
      description: SAMPLE_IMPACT.description,
      valid_date: item.date ?? dateStr,
      source: 'api',
    }
  } catch (err) {
    console.warn('[impactForecast] fallback:', err)
    return { ...SAMPLE_IMPACT, valid_date: dateStr }
  }
}
