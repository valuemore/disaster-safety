'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROLE_LABELS, type RoleKey } from '@/lib/disaster/types'
import type { StaffContact, StaffContactRole } from '@/lib/types/db'

const ROLES: StaffContactRole[] = [
  'director',
  'homeroom_teacher',
  'bus_manager',
  'cook_or_food_service',
  'health_manager',
]

interface ContactRow {
  role: StaffContactRole
  name: string
  phone: string
  email: string
  consent_sms: boolean
  consent_kakao: boolean
  consent_share_link: boolean
  is_active: boolean
}

function emptyRow(role: StaffContactRole): ContactRow {
  return {
    role,
    name: '',
    phone: '',
    email: '',
    consent_sms: false,
    consent_kakao: false,
    consent_share_link: false,
    is_active: true,
  }
}

export function StaffContactsForm() {
  const [rows, setRows] = useState<ContactRow[]>(ROLES.map(emptyRow))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/account/contacts', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!active) return
        const existing: StaffContact[] = json.data ?? []
        setRows(
          ROLES.map((role) => {
            const found = existing.find((c) => c.role === role)
            return found
              ? {
                  role,
                  name: found.name ?? '',
                  phone: found.phone ?? '',
                  email: found.email ?? '',
                  consent_sms: found.consent_sms,
                  consent_kakao: found.consent_kakao,
                  consent_share_link: found.consent_share_link,
                  is_active: found.is_active,
                }
              : emptyRow(role)
          })
        )
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  function patch(role: StaffContactRole, p: Partial<ContactRow>) {
    setRows((prev) => prev.map((r) => (r.role === role ? { ...r, ...p } : r)))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/account/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: rows }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '저장에 실패했습니다.')
        return
      }
      toast.success('담당자 연락처가 저장되었습니다.')
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">불러오는 중…</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        교직원 업무 연락처는 대응계획 공유·발송 목적으로만 저장됩니다. 수신 동의를 함께 등록하세요.
        보호자(학부모) 연락처는 저장하지 않습니다.
      </div>

      {rows.map((row) => (
        <Card key={row.role}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{ROLE_LABELS[row.role as RoleKey]}</span>
              <label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <input
                  type="checkbox"
                  checked={row.is_active}
                  onChange={(e) => patch(row.role, { is_active: e.target.checked })}
                />
                사용
              </label>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                placeholder="담당자명/직함"
                value={row.name}
                onChange={(e) => patch(row.role, { name: e.target.value })}
                className="rounded-md border bg-background px-2.5 py-2 text-sm"
              />
              <input
                type="tel"
                inputMode="tel"
                placeholder="휴대폰 (010-0000-0000)"
                value={row.phone}
                onChange={(e) => patch(row.role, { phone: e.target.value.replace(/[^0-9-]/g, '') })}
                className="rounded-md border bg-background px-2.5 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="이메일 (선택)"
                value={row.email}
                onChange={(e) => patch(row.role, { email: e.target.value })}
                className="rounded-md border bg-background px-2.5 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={row.consent_sms} onChange={(e) => patch(row.role, { consent_sms: e.target.checked })} />
                문자 수신 동의
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={row.consent_kakao} onChange={(e) => patch(row.role, { consent_kakao: e.target.checked })} />
                알림톡 수신 동의
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={row.consent_share_link} onChange={(e) => patch(row.role, { consent_share_link: e.target.checked })} />
                공유 링크 수신 동의
              </label>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button onClick={handleSave} disabled={saving} className="w-full min-h-[48px] text-base font-semibold">
        {saving ? '저장 중…' : '연락처 저장'}
      </Button>
    </div>
  )
}
