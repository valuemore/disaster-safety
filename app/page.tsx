'use client'

import { useRouter } from 'next/navigation'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRole } from '@/components/providers/RoleProvider'
import type { Role } from '@/lib/types/db'

const ROLES: { id: Role; label: string; emoji: string; description: string; href: string }[] = [
  {
    id: 'director',
    label: '원장',
    emoji: '🏫',
    description: '기관 전체 대응 총괄',
    href: '/plan/new?role=director',
  },
  {
    id: 'teacher',
    label: '담임교사',
    emoji: '👩‍🏫',
    description: '보육실 단위 즉시 실행',
    href: '/plan/new?role=teacher',
  },
  {
    id: 'shuttle',
    label: '통학버스 담당자',
    emoji: '🚌',
    description: '차량 폭염 안전 관리',
    href: '/plan/new?role=shuttle',
  },
  {
    id: 'admin',
    label: '지자체 관리자',
    emoji: '🏛️',
    description: '관할 기관 현황 모니터링',
    href: '/admin',
  },
]

export default function HomePage() {
  const router = useRouter()
  const { setRole } = useRole()

  function handleRoleSelect(role: Role, href: string) {
    setRole(role)
    router.push(href)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">재난안전MVP</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          폭염 재난문자 → 유아교육기관 역할별 대응 체크리스트 · 학부모 안내문 · 사후기록
        </p>
      </div>

      <section aria-labelledby="role-title" className="mb-8">
        <h2 id="role-title" className="mb-4 text-base font-semibold">
          역할을 선택하세요
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role.id, role.href)}
              className="block w-full text-left"
            >
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-2xl" aria-hidden="true">
                      {role.emoji}
                    </span>
                    {role.label}
                  </CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full min-h-[44px]"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    시작하기
                  </Button>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </section>

      <SafetyNotice />
    </div>
  )
}
