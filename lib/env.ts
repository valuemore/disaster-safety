/**
 * 환경변수 중앙화 + 키 미설정 시 샘플 모드 분기.
 * 서버 전용 값(ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY 등)은
 * 반드시 Server Route / Server Action 에서만 사용한다.
 */

/** 외부 의존(AI/API/DB) 전면 차단 → 샘플 데이터로 시연 */
export const USE_SAMPLE_FALLBACK =
  process.env.USE_SAMPLE_FALLBACK === 'true'

/** Supabase (클라이언트 노출 가능) */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** AI (서버 전용) */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ''
export const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

/** 공공 API (서버 전용) */
export const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY ?? ''
export const KMA_API_KEY = process.env.KMA_API_KEY ?? ''
// 초단기예보 전용 키. 미설정 시 KMA_API_KEY로 fallback.
export const KMA_WEATHER_API_KEY = process.env.KMA_WEATHER_API_KEY || process.env.KMA_API_KEY || ''
export const MOIS_DISASTER_API_KEY = process.env.MOIS_DISASTER_API_KEY ?? ''
export const CHILDCARE_API_KEY = process.env.CHILDCARE_API_KEY ?? ''
export const KINDERGARTEN_API_KEY = process.env.KINDERGARTEN_API_KEY ?? ''

/** 설정 상태 헬퍼 */
export const isAiConfigured = (): boolean =>
  !USE_SAMPLE_FALLBACK && ANTHROPIC_API_KEY.length > 0

export const isDbConfigured = (): boolean =>
  !USE_SAMPLE_FALLBACK && SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
