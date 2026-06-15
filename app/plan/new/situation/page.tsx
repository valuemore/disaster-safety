import { SituationPicker } from '@/components/plan/SituationPicker'
import { WizardProgress } from '@/components/wizard/WizardProgress'

export const metadata = {
  title: '현재 상황 선택 — 재난안전MVP',
}

export default function SituationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <WizardProgress currentStep={2} />

      <div className="mb-6">
        <h1 className="text-xl font-bold">현재 상황 선택</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          지금 기관에서 진행 중인 상황을 선택하세요. 최대 3개.
        </p>
      </div>

      <SituationPicker />
    </div>
  )
}
