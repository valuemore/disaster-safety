import { USE_SAMPLE_FALLBACK } from '@/lib/env'

export type DataSource = 'db' | 'api' | 'sample'

export interface WithSourceResult<T> {
  data: T
  source: DataSource
}

/**
 * DB / 외부 API 호출을 래핑한다.
 * - USE_SAMPLE_FALLBACK=true → 즉시 샘플 반환
 * - 설정 미비 또는 에러 → 샘플 반환
 * - 정상 → 실데이터 반환
 */
export async function withDbFallback<T>(
  dbFn: () => Promise<T>,
  sampleFn: () => T,
  source: Exclude<DataSource, 'sample'> = 'db'
): Promise<WithSourceResult<T>> {
  if (USE_SAMPLE_FALLBACK) {
    return { data: sampleFn(), source: 'sample' }
  }
  try {
    const data = await dbFn()
    return { data, source }
  } catch (err) {
    console.error(`[withDbFallback] ${source} 호출 실패 → 샘플 반환:`, err)
    return { data: sampleFn(), source: 'sample' }
  }
}

/**
 * 외부 API(공공 API 등) 호출에 timeout + 1회 재시도를 적용한다.
 */
export async function withApiFallback<T>(
  apiFn: () => Promise<T>,
  sampleFn: () => T,
  timeoutMs = 5000
): Promise<WithSourceResult<T>> {
  if (USE_SAMPLE_FALLBACK) {
    return { data: sampleFn(), source: 'sample' }
  }

  const withTimeout = (fn: () => Promise<T>): Promise<T> =>
    Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('API timeout')), timeoutMs)
      ),
    ])

  try {
    const data = await withTimeout(apiFn)
    return { data, source: 'api' }
  } catch {
    try {
      const data = await withTimeout(apiFn)
      return { data, source: 'api' }
    } catch (err) {
      console.error('[withApiFallback] 재시도 실패 → 샘플 반환:', err)
      return { data: sampleFn(), source: 'sample' }
    }
  }
}
