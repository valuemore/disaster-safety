// 주소→좌표 변환 서비스 (Kakao Local REST API, 서버 전용)
// 키 없거나 실패 시 샘플 좌표 fallback
import { USE_SAMPLE_FALLBACK, GEOCODE_API_KEY } from '@/lib/env'

const TIMEOUT_MS = 5_000

export interface GeocodeResult {
  lat: number
  lng: number
  sido: string
  sigungu: string
  dong: string
  source: 'api' | 'sample'
}

// 샘플 주소 → 좌표 매핑 (시드 기관과 일치)
const SAMPLE_COORDS: Record<string, Omit<GeocodeResult, 'source'>> = {
  default: { lat: 37.5665, lng: 126.978, sido: '서울특별시', sigungu: '중구', dong: '명동' },
  서울: { lat: 37.5665, lng: 126.978, sido: '서울특별시', sigungu: '강서구', dong: '화곡동' },
  경기: { lat: 37.2636, lng: 127.0286, sido: '경기도', sigungu: '수원시', dong: '영통동' },
  부산: { lat: 35.1796, lng: 129.0756, sido: '부산광역시', sigungu: '해운대구', dong: '우동' },
  대구: { lat: 35.8714, lng: 128.6014, sido: '대구광역시', sigungu: '중구', dong: '동성로' },
  인천: { lat: 37.4563, lng: 126.7052, sido: '인천광역시', sigungu: '남동구', dong: '구월동' },
  광주: { lat: 35.1595, lng: 126.8526, sido: '광주광역시', sigungu: '서구', dong: '치평동' },
  대전: { lat: 36.3504, lng: 127.3845, sido: '대전광역시', sigungu: '서구', dong: '둔산동' },
  울산: { lat: 35.5384, lng: 129.3114, sido: '울산광역시', sigungu: '남구', dong: '삼산동' },
  세종: { lat: 36.4800, lng: 127.2890, sido: '세종특별자치시', sigungu: '세종시', dong: '한솔동' },
}

function sampleFallback(query: string): GeocodeResult {
  const key = Object.keys(SAMPLE_COORDS).find(
    (k) => k !== 'default' && query.includes(k)
  ) ?? 'default'
  return { ...SAMPLE_COORDS[key], source: 'sample' }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms)),
  ])
}

export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  if (!query.trim()) return sampleFallback(query)
  if (USE_SAMPLE_FALLBACK || !GEOCODE_API_KEY) return sampleFallback(query)

  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`

  try {
    const res = await withTimeout(
      fetch(url, { headers: { Authorization: `KakaoAK ${GEOCODE_API_KEY}` } }),
      TIMEOUT_MS
    )
    if (!res.ok) throw new Error(`Kakao ${res.status}`)
    const json = await res.json()

    const doc = json?.documents?.[0]
    if (!doc) return sampleFallback(query)

    // road_address 우선, 없으면 address
    const addr = doc.road_address ?? doc.address
    if (!addr) return sampleFallback(query)

    return {
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
      sido: addr.region_1depth_name ?? '',
      sigungu: addr.region_2depth_name ?? '',
      dong: addr.region_3depth_name ?? addr.region_3depth_h_name ?? '',
      source: 'api',
    }
  } catch (err) {
    console.warn('[geocode] fallback:', err)
    return sampleFallback(query)
  }
}
