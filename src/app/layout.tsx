import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'SemanticToolz — AI Content Optimizer',
  description: 'Rank higher on Google. Get cited by every AI. 14 AI-powered SEO tools for content teams, SEOs and agencies.',
  openGraph: {
    title: 'SemanticToolz v2',
    description: 'AI-powered content optimization for Google & AI search',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-white text-slate-900`}>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
