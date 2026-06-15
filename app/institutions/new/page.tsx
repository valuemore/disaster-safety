import { InstitutionForm } from '@/components/institutions/InstitutionForm'
import { SafetyNotice } from '@/components/common/SafetyNotice'

export const metadata = {
  title: '기관 등록 — 재난안전MVP',
}

export default function InstitutionNewPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">기관 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          등록 후 폭염 대응 프로필을 입력합니다.
        </p>
      </div>

      <InstitutionForm />

      <div className="mt-6">
        <SafetyNotice />
      </div>
    </div>
  )
}
