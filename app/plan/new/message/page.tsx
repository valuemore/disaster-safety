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
        <h1 className="text-xl font-bold">재난문자 선택</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          대응계획을 생성할 재난문자를 선택하거나 원문을 붙여넣으세요.
        </p>
      </div>

      <MessageInput />
    </div>
  )
}
