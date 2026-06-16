import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppHeader } from '@/components/common/AppHeader'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/components/providers/SessionProvider'

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '재난안전MVP — 유아교육기관 재난 대응 지원',
  description:
    '지자체 재난문자를 유아교육기관 운영상황에 맞게 원장·담임교사·통학버스·조리·보건 담당자별 대응계획으로 변환하는 AI 기반 재난대응 서비스',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <SessionProvider>
          <AppHeader />
          <main className="flex-1">{children}</main>
          <Toaster position="bottom-center" richColors />
        </SessionProvider>
      </body>
    </html>
  )
}
