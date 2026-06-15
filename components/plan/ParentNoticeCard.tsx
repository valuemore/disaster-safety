'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ParentNoticeCardProps {
  text: string
}

export function ParentNoticeCard({ text }: ParentNoticeCardProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('학부모 안내문이 복사되었습니다.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했습니다. 직접 선택해서 복사해 주세요.')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">학부모 안내문</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-3 text-sm leading-relaxed">
          {text}
        </p>
        <Button
          onClick={handleCopy}
          variant={copied ? 'default' : 'outline'}
          className="w-full min-h-[44px]"
        >
          {copied ? '✓ 복사됨' : '📋 안내문 복사하기'}
        </Button>
      </CardContent>
    </Card>
  )
}
