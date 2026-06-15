import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey)
}

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase 환경변수 미설정 — USE_SAMPLE_FALLBACK=true로 샘플 모드로 전환하세요.'
    )
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
