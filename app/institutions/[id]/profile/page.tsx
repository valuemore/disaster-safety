import { notFound } from 'next/navigation'
import { ProfileForm } from '@/components/institutions/ProfileForm'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { getSampleInstitution, SAMPLE_INSTITUTIONS } from '@/lib/sample'
import type { Institution } from '@/lib/types/db'

interface PageProps {
  params: Promise<{ id: string }>
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

export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params
  const institution = await getInstitution(id)

  if (!institution) notFound()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">폭염 대응 프로필</h1>
        <p className="mt-1 text-sm text-muted-foreground">{institution.name}</p>
      </div>

      <ProfileForm
        institutionId={institution.id}
        hasShuttle={institution.has_shuttle}
      />

      <div className="mt-6">
        <SafetyNotice />
      </div>
    </div>
  )
}
