'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { ContentProvider } from '@/context/ContentContext'

type UsageData = { plan: string; count: number; limit: number; remaining: number }

const FREE_TOOLS   = ['scores','issues','entities','aicite']
const PRO_TOOLS    = ['eeat','backlinks','rewrite','citation','gap','queries']
const AGENCY_TOOLS = ['tracker','local','serp','topical']

const TOOL_META: Record<string, { label: string; icon: string }> = {
  scores:    { label: 'Scores',             icon: '📊' },
  issues:    { label: 'Issues',             icon: '🔍' },
  entities:  { label: 'Entities',           icon: '🔗' },
  aicite:    { label: 'AI Cite Score',      icon: '🤖' },
  eeat:      { label: 'E-E-A-T',            icon: '🏆' },
  backlinks: { label: 'Relevant Backlinks', icon: '🔗' },
  rewrite:   { label: 'AI Rewrite',         icon: '✍️' },
  citation:  { label: 'Citation Plan',      icon: '📎' },
  gap:       { label: 'Content Gap',        icon: '🕳️' },
  queries:   { label: 'AI Queries',         icon: '🔎' },
  tracker:   { label: 'Cite Tracker',       icon: '🎯' },
  local:     { label: 'Local SEO',          icon: '📍' },
  serp:      { label: 'SERP Audit',         icon: '📈' },
  topical:   { label: 'Topical Authority',  icon: '🗺️' },
  settings:  { label: 'Settings',           icon: '⚙️' },
}

function isUnlocked(tool: string, plan: string): boolean {
  if (AGENCY_TOOLS.includes(tool)) return plan === 'AGENCY'
  if (PRO_TOOLS.includes(tool)) return plan === 'PRO' || plan === 'AGENCY'
  return true
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const pathname = usePathname()
  const currentTool = pathname.split('/').pop() ?? 'scores'

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(setUsage).catch(() => {})
  }, [])

  const plan = usage?.plan ?? 'FREE'
  const pct  = usage ? Math.min(100, (usage.count / usage.limit) * 100) : 0
  const planColor = plan === 'AGENCY'
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : plan === 'PRO'
    ? 'text-blue-700 bg-blue-50 border-blue-200'
    : 'text-slate-500 bg-slate-100 border-slate-200'

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
                <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-600'}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-slate-400 mt-1">{usage.remaining} left this month</div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 py-3">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Content Analyzer</div>
            {FREE_TOOLS.map(t => <NavItem key={t} tool={t} current={currentTool} unlocked />)}

            <div className="px-3 py-1.5 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Pro — $19/mo</div>
            {PRO_TOOLS.map(t => <NavItem key={t} tool={t} current={currentTool} unlocked={isUnlocked(t, plan)} />)}

            <div className="px-3 py-1.5 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Agency — $49/mo</div>
            {AGENCY_TOOLS.map(t => <NavItem key={t} tool={t} current={currentTool} unlocked={isUnlocked(t, plan)} />)}

          <div className="px-2 mt-2 mb-1">
            <div className="h-px bg-slate-100 mb-1" />
            <NavItem tool="settings" current={currentTool} unlocked />
          </div>
        </nav>

        {/* User + upgrade */}
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
              {usage?.plan ? (usage.plan.charAt(0) + usage.plan.slice(1).toLowerCase()) : ''}
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

function NavItem({ tool, current, unlocked }: { tool: string; current: string; unlocked: boolean }) {
  const meta = TOOL_META[tool]
  const isActive = current === tool
  return (
    <Link
      href={unlocked ? `/dashboard/${tool}` : '/pricing'}
      className={`flex items-center gap-2 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span className="w-5 text-center text-base leading-none">{meta.icon}</span>
      <span className="flex-1 text-xs font-medium">{meta.label}</span>
      {!unlocked && <span className="text-slate-300 text-xs">🔒</span>}
    </Link>
  )
}
