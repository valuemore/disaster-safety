import { notFound } from 'next/navigation'
import { ProfileForm } from '@/components/institutions/ProfileForm'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { ProfileTypeTabs } from '@/components/institutions/ProfileTypeTabs'
import { StaffRecommendationSection } from '@/components/institutions/StaffRecommendationSection'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { getSampleInstitution, SAMPLE_INSTITUTIONS } from '@/lib/sample'
import type { Institution } from '@/lib/types/db'
import type { DisasterType } from '@/lib/disaster/types'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ disaster_type?: string }>
}

async function getInstitution(id: string): Promise<Institution | null> {
  if (USE_SAMPLE_FALLBACK) {
    return getSampleInstitution(id) ?? SAMPLE_INSTITUTIONS[0]
  }
  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Institution
  } catch {
    return getSampleInstitution(id) ?? null
  }
}

const DISASTER_TYPE_LABELS: Record<DisasterType, string> = {
  heatwave: '폭염',
  heavy_rain: '집중호우',
  infection: '감염병',
}

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { disaster_type } = await searchParams

  // 유효한 재난유형만 허용, 기본값 heatwave
  const disasterType: DisasterType =
    disaster_type === 'heavy_rain' || disaster_type === 'infection'
      ? (disaster_type as DisasterType)
      : 'heatwave'

  const institution = await getInstitution(id)

  if (!institution) notFound()

  const typeLabel = DISASTER_TYPE_LABELS[disasterType]

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">재난 대응 프로필</h1>
        <p className="mt-1 text-sm text-muted-foreground">{institution.name}</p>
      </div>

      {/* 재난유형 탭 */}
      <div className="mb-6">
        <ProfileTypeTabs institutionId={id} currentType={disasterType} />
      </div>

      <div className="mb-4">
        <h2 className="text-base font-semibold">{typeLabel} 대응 프로필</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {disasterType === 'heavy_rain'
            ? '기관의 집중호우 대응 관련 시설·환경 정보를 입력합니다.'
            : disasterType === 'infection'
              ? '기관의 감염병 대응 관련 위생·시설·매뉴얼 현황을 입력합니다. 이름·진단명·연락처는 입력하지 않습니다.'
              : '기관의 폭염 대응 관련 시설·물품 현황을 입력합니다.'}
        </p>
      </div>

      <ProfileForm
        institutionId={institution.id}
        hasShuttle={institution.has_shuttle}
        disasterType={disasterType}
      />

      {/* 급식·보건 인력 기반 역할 배치 기준 안내 */}
      <StaffRecommendationSection
        institution={{
          type: institution.type,
          total_children: institution.total_children,
          staff_profile: institution.staff_profile,
        }}
      />

      <div className="mt-6">
        <SafetyNotice />
      </div>
    </div>
  )
}
