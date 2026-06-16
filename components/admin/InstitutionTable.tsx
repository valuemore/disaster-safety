'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface InstitutionRow {
  id: string
  name: string
  type: string
  sido: string | null
  sigungu: string | null
  total_children: number | null
  has_shuttle: boolean
}

export function InstitutionTable() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [size] = useState(20)
  const [rows, setRows] = useState<InstitutionRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/institutions?${params}`, { cache: 'no-store' })
      const json = await res.json()
      setRows(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, size, q])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / size))

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1)
              void load()
            }
          }}
          placeholder="기관명 검색"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <Button variant="outline" onClick={() => { setPage(1); void load() }}>검색</Button>
      </div>

      <p className="text-xs text-muted-foreground">전체 {total.toLocaleString()}개 기관</p>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">기관이 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">기관명</th>
                <th className="px-3 py-2 text-left">지역</th>
                <th className="px-3 py-2 text-right">유아수</th>
                <th className="px-3 py-2 text-center">통학</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/admin/institutions/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[r.sido, r.sigungu].filter(Boolean).join(' ') || '-'}
                  </td>
                  <td className="px-3 py-2 text-right">{r.total_children ?? '-'}</td>
                  <td className="px-3 py-2 text-center">{r.has_shuttle ? '○' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          이전
        </Button>
        <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          다음
        </Button>
      </div>
    </div>
  )
}
