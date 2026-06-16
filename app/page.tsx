'use client'

import Link from 'next/link'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const STEPS = [
  { emoji: '📩', title: '재난문자 입력', desc: '지자체 재난문자를 붙여넣거나 실시간 조회 — AI가 재난유형을 자동 분류합니다.' },
  { emoji: '✅', title: '현재 상황 선택', desc: '기관의 현재 운영 상황을 선택합니다.' },
  { emoji: '📋', title: '역할별 대응계획', desc: '원장·담임·통학버스·조리·보건 담당자별 대응계획을 생성합니다.' },
  { emoji: '📨', title: '담당자에게 공유', desc: '역할별 대응계획을 링크·문자·알림톡·인쇄로 전달합니다.' },
]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">재난안전MVP</h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          지자체 재난문자를 유아교육기관 운영상황에 맞춘
          <br className="hidden sm:block" />
          역할별 대응계획으로 변환하는 AI 재난대응 지원 서비스
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login">
            <Button className="min-h-[48px] px-6 text-base font-semibold">기관 로그인</Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary" className="min-h-[48px] px-6 text-base font-semibold">
              기관 등록
            </Button>
          </Link>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-base font-semibold">이용 흐름</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-2xl" aria-hidden="true">{step.emoji}</span>
                  <span className="text-xs font-normal text-muted-foreground">STEP {i + 1}</span>
                  {step.title}
                </CardTitle>
                <CardDescription>{step.desc}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </section>

      <SafetyNotice />
    </div>
  )
}
