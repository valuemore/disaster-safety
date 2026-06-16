'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { useSession } from '@/components/providers/SessionProvider'

export default function LoginPage() {
  const router = useRouter()
  const { refresh } = useSession()
  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginId.trim() || pin.length < 4) {
      toast.error('기관 등록번호와 4자리 이상 PIN을 입력하세요.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId.trim(), pin }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '로그인에 실패했습니다.')
        setSubmitting(false)
        return
      }
      await refresh()
      toast.success(`${json.data.name} 로그인되었습니다.`)
      router.push('/plan/new/message')
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">기관 로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          재난문자를 받으셨나요? 기관 계정으로 로그인하여 대응계획을 생성하세요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">로그인</CardTitle>
          <CardDescription>기관 등록번호와 PIN을 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-id" className="mb-1 block text-sm font-medium">
                기관 등록번호
              </label>
              <input
                id="login-id"
                type="text"
                inputMode="text"
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="예: 어린이집코드 또는 발급받은 등록번호"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="pin" className="mb-1 block text-sm font-medium">
                PIN (4~8자리)
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full min-h-[48px] text-base font-semibold">
              {submitting ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            아직 등록하지 않으셨나요?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              기관 등록하기
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <SafetyNotice />
      </div>
    </div>
  )
}
