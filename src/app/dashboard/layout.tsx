'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { ContentProvider } from '@/context/ContentContext'

type UsageData = { plan: string; count: number; limit: number; remaining: number }

const TOOLS = [
  { id: 'scores', label: 'Content Analyzer', icon: '📊', href: '/dashboard', minPlan: 'FREE' },
  { id: 'issues', label: 'Issues Audit',      icon: '🔍', href: '/dashboard/issues', minPlan: 'FREE' },
  { id: 'optimizer', label: 'Content Optimizer', icon: '⚡', href: '/dashboard/optimizer', minPlan: 'PRO' },
]

function isUnlocked(minPlan: string, userPlan: string): boolean {
  if (minPlan === 'FREE') return true
  if (minPlan === 'PRO') return userPlan === 'PRO' || userPlan === 'AGENCY'
  if (minPlan === 'AGENCY') return userPlan === 'AGENCY'
  return false
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(setUsage).catch(() => {})
  }, [])

  const plan = usage?.plan ?? 'FREE'
  const pct  = usage ? Math.min(100, (usage.count / usage.limit) * 100) : 0

  const planColor =
    plan === 'AGENCY' ? 'text-amber-700 bg-amber-50 border-amber-200' :
    plan === 'PRO'    ? 'text-blue-700 bg-blue-50 border-blue-200' :
                        'text-slate-500 bg-slate-100 border-slate-200'

  function isActive(tool: typeof TOOLS[0]) {
    if (tool.id === 'scores') return pathname === '/dashboard'
    return pathname === tool.href
  }

  return (
    <ContentProvider>
      <div className="flex h-screen overflow-hidden bg-white">
        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-200">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">◈</span>
              <span className="font-extrabold text-sm tracking-tight">SemanticToolz</span>
            </Link>
          </div>

          {/* Plan + usage */}
          {usage && (
            <div className="px-4 py-3 border-b border-slate-200">
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${planColor}`}>
                {plan} — {usage.count}/{usage.limit}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-600'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-1">{usage.remaining} analyses left this month</div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 py-3">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tools</div>
            {TOOLS.map(tool => {
              const unlocked = isUnlocked(tool.minPlan, plan)
              const active = isActive(tool)
              return (
                <Link
                  key={tool.id}
                  href={unlocked ? tool.href : '/pricing'}
                  className={`flex items-center gap-2 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-5 text-center text-base leading-none">{tool.icon}</span>
                  <span className="flex-1 text-xs font-medium">{tool.label}</span>
                  {!unlocked && <span className="text-slate-300 text-xs">🔒</span>}
                  {tool.minPlan === 'PRO' && unlocked && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">PRO</span>}
                </Link>
              )
            })}

            <div className="mx-2 mt-2 h-px bg-slate-100" />
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-2 mx-2 mt-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === '/dashboard/settings' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="w-5 text-center text-base leading-none">⚙️</span>
              <span className="text-xs font-medium">Settings</span>
            </Link>
          </nav>

          {/* Upgrade CTA + User */}
          <div className="border-t border-slate-200 p-4 space-y-2">
            {plan === 'FREE' && (
              <Link href="/pricing" className="block w-full rounded-lg bg-blue-600 py-2 text-center text-xs font-bold text-white hover:bg-blue-700">
                Upgrade to Pro →
              </Link>
            )}
            {plan === 'PRO' && (
              <Link href="/pricing" className="block w-full rounded-lg bg-amber-500 py-2 text-center text-xs font-bold text-white hover:bg-amber-600">
                Upgrade to Agency →
              </Link>
            )}
            <div className="flex items-center gap-2">
              <UserButton afterSignOutUrl="/" />
              <span className="text-xs text-slate-400 truncate">
                {plan.charAt(0) + plan.slice(1).toLowerCase()} Plan
              </span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </ContentProvider>
  )
}
