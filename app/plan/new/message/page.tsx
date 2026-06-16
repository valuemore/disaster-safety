import { MessageInput } from '@/components/plan/MessageInput'
import { WizardProgress } from '@/components/wizard/WizardProgress'

export const metadata = {
  title: '재난문자 선택 — 재난안전MVP',
}

export default function MessagePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <WizardProgress currentStep={1} />

      <div className="mb-6">
        <h1 className="text-xl font-bold">재난문자 입력</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          수신한 재난문자를 붙여넣거나 실시간으로 조회하세요. 재난유형은 자동으로 분류됩니다.
        </p>
      </div>

      <MessageInput />
    </div>
  )
}
