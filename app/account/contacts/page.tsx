import { StaffContactsForm } from '@/components/institutions/StaffContactsForm'

export const metadata = {
  title: '담당자 연락처 — 재난안전MVP',
}

export default function ContactsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">역할별 담당자 연락처</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          대응계획을 공유·발송할 역할별 담당자 연락처와 수신 동의를 등록하세요.
        </p>
      </div>
      <StaffContactsForm />
    </div>
  )
}
