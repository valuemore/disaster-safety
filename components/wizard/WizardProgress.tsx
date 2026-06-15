import { cn } from '@/lib/utils'

const STEPS = [
  { label: '재난유형 선택', short: '유형' },
  { label: '재난문자 선택', short: '재난문자' },
  { label: '현재 상황 선택', short: '상황 선택' },
  { label: '대응계획 생성', short: '생성' },
]

interface WizardProgressProps {
  currentStep: 1 | 2 | 3 | 4 // 1=type, 2=message, 3=situation, 4=generate
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <nav aria-label="대응계획 생성 단계" className="mb-6">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const stepNum = idx + 1
          const isDone = stepNum < currentStep
          const isActive = stepNum === currentStep

          return (
            <li key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    isDone && 'bg-primary text-primary-foreground',
                    isActive && 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2',
                    !isDone && !isActive && 'bg-muted text-muted-foreground'
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <span
                  className={cn(
                    'mt-1 text-[10px] sm:text-xs',
                    isActive ? 'font-medium text-primary' : 'text-muted-foreground'
                  )}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.short}</span>
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 flex-1 transition-colors sm:mx-2',
                    isDone ? 'bg-primary' : 'bg-muted'
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
