import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Institution } from '@/lib/types/db'
import { RoleStatusSummary } from '@/components/admin/RoleStatusSummary'

interface InstitutionCardProps {
  institution: Institution
  showDetailLink?: boolean
}

const TYPE_LABEL: Record<string, string> = {
  daycare: '어린이집',
  kindergarten: '유치원',
}

export function InstitutionCard({ institution, showDetailLink = true }: InstitutionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{institution.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {TYPE_LABEL[institution.type] ?? institution.type} · {institution.sido} {institution.sigungu}
            </p>
          </div>
          {showDetailLink && (
            <Link
              href={`/admin/institutions/${institution.id}`}
              className="shrink-0 text-xs text-primary hover:underline"
            >
              상세 →
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">전체 아동</dt>
            <dd className="font-medium">{institution.total_children ?? '-'}명</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">교직원</dt>
            <dd className="font-medium">{institution.staff_count ?? '-'}명</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">통학버스</dt>
            <dd className="font-medium">{institution.has_shuttle ? '있음' : '없음'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">냉방공간</dt>
            <dd className="font-medium">{institution.cooling_space_count}곳</dd>
          </div>
        </dl>

        {/* 역할 지정 현황 */}
        {institution.staff_profile !== undefined && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">역할 지정 현황</p>
            <RoleStatusSummary institution={institution} />
            <p className="mt-1 text-xs text-muted-foreground">
              기관 프로필 기반 참고 정보입니다.{' '}
              {showDetailLink && (
                <Link
                  href={`/admin/institutions/${institution.id}`}
                  className="text-primary hover:underline"
                >
                  상세 확인 →
                </Link>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
