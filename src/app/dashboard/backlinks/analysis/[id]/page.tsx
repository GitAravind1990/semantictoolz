'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

type BacklinkItem = {
  url_from: string
  domain_from: string
  url_to: string
  anchor: string
  dofollow: boolean
  domain_from_rank: number
  first_seen: string
  last_seen: string
  is_new: boolean
  is_lost: boolean
  attributes: string[]
  item_type: string
}

type ReferringDomain = {
  domain: string
  rank: number
  backlinks: number
  dofollow: number
  nofollow: number
  is_new: boolean
  is_lost: boolean
  first_seen: string
  last_seen: string
  spam_score?: number
}

type Analysis = {
  id: string
  domain: string
  backlinksTotal: number
  dofollowLinks: number
  nofollowLinks: number
  referringDomains: number
  referringIPs: number
  spamScore: number
  domainRank: number
  newBacklinks14d: number
  lostBacklinks14d: number
  newReferringDomains14d: number
  lostReferringDomains14d: number
  brokenBacklinks: number
  topBacklinks: BacklinkItem[]
  topReferringDomains: ReferringDomain[]
  createdAt: string
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function spamBadge(score: number) {
  if (score <= 20) return 'bg-green-100 text-green-700'
  if (score <= 50) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function rankBadge(rank: number) {
  if (rank <= 100) return 'bg-purple-100 text-purple-700'
  if (rank <= 1000) return 'bg-blue-100 text-blue-700'
  if (rank <= 10000) return 'bg-slate-100 text-slate-600'
  return 'bg-slate-50 text-slate-400'
}

const TABS = ['Overview', 'Backlinks', 'Referring Domains'] as const
type Tab = typeof TABS[number]

export default function BacklinkAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')
  const [filterDofollow, setFilterDofollow] = useState<'all' | 'dofollow' | 'nofollow'>('all')
  const [anchor, setAnchor] = useState('')

  useEffect(() => {
    fetch(`/api/tools/backlinks/domain-analysis/${id}`)
      .then(r => r.json())
      .then(d => { setAnalysis(d); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-400">Loading report...</div>
  if (!analysis) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-2">❌</div>
        <div className="font-bold text-slate-700">Analysis not found</div>
        <Link href="/dashboard/backlinks" className="text-sm text-blue-600 mt-2 inline-block">← Back</Link>
      </div>
    </div>
  )

  const dofollowPct = analysis.backlinksTotal > 0
    ? Math.round((analysis.dofollowLinks / analysis.backlinksTotal) * 100) : 0

  const filteredBacklinks = analysis.topBacklinks.filter(b => {
    if (filterDofollow === 'dofollow' && !b.dofollow) return false
    if (filterDofollow === 'nofollow' && b.dofollow) return false
    if (anchor && !b.anchor?.toLowerCase().includes(anchor.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/dashboard/backlinks" className="text-sm text-slate-400 hover:text-slate-600">← Back</Link>
          <h1 className="text-xl font-black text-slate-800">📊 {analysis.domain}</h1>
          <span className="text-xs text-slate-400 ml-auto">
            Data fetched {new Date(analysis.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5 pb-10">

        {/* ── OVERVIEW TAB ── */}
        {tab === 'Overview' && (
          <>
            {/* Hero metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Backlinks', value: fmt(analysis.backlinksTotal), sub: `${fmt(analysis.dofollowLinks)} dofollow`, color: 'text-blue-700' },
                { label: 'Referring Domains', value: fmt(analysis.referringDomains), sub: `${fmt(analysis.referringIPs)} unique IPs`, color: 'text-slate-700' },
                { label: 'Domain Rank', value: analysis.domainRank > 0 ? `#${fmt(analysis.domainRank)}` : '—', sub: 'by DataForSEO', color: 'text-purple-700' },
                { label: 'Spam Score', value: `${analysis.spamScore}/100`, sub: analysis.spamScore <= 20 ? 'Clean' : analysis.spamScore <= 50 ? 'Moderate' : 'High risk', color: analysis.spamScore <= 20 ? 'text-green-600' : analysis.spamScore <= 50 ? 'text-amber-600' : 'text-red-600' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <div className={`text-3xl font-black ${m.color}`}>{m.value}</div>
                  <div className="text-xs font-semibold text-slate-600 mt-1">{m.label}</div>
                  <div className="text-[10px] text-slate-400">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Dofollow breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                <span>Link Type Distribution</span>
              </div>
              <div className="h-4 rounded-full bg-slate-100 overflow-hidden flex mb-2">
                <div className="h-full bg-green-500 flex items-center justify-center text-[9px] text-white font-bold" style={{ width: `${dofollowPct}%` }}>
                  {dofollowPct > 10 ? `${dofollowPct}%` : ''}
                </div>
                <div className="h-full bg-slate-300 flex items-center justify-center text-[9px] text-white font-bold" style={{ width: `${100 - dofollowPct}%` }}>
                  {(100 - dofollowPct) > 10 ? `${100 - dofollowPct}%` : ''}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />Dofollow {fmt(analysis.dofollowLinks)}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" />Nofollow {fmt(analysis.nofollowLinks)}</span>
              </div>
            </div>

            {/* 14-day delta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'New Backlinks (14d)', value: `+${fmt(analysis.newBacklinks14d)}`, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Lost Backlinks (14d)', value: `-${fmt(analysis.lostBacklinks14d)}`, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
                { label: 'New Ref. Domains (14d)', value: `+${fmt(analysis.newReferringDomains14d)}`, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Lost Ref. Domains (14d)', value: `-${fmt(analysis.lostReferringDomains14d)}`, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
              ].map(m => (
                <div key={m.label} className={`rounded-xl border p-4 text-center ${m.bg}`}>
                  <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Additional stats */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-slate-700">{fmt(analysis.referringIPs)}</div>
                <div className="text-xs text-slate-400">Unique IPs</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-600">{fmt(analysis.brokenBacklinks)}</div>
                <div className="text-xs text-slate-400">Broken Backlinks</div>
              </div>
              <div>
                <div className={`text-xl font-bold`}>{dofollowPct}%</div>
                <div className="text-xs text-slate-400">Dofollow Ratio</div>
              </div>
            </div>
          </>
        )}

        {/* ── BACKLINKS TAB ── */}
        {tab === 'Backlinks' && (
          <>
            {/* Filters */}
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {(['all', 'dofollow', 'nofollow'] as const).map(f => (
                  <button key={f} onClick={() => setFilterDofollow(f)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterDofollow === f ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <input value={anchor} onChange={e => setAnchor(e.target.value)}
                placeholder="Filter by anchor text..."
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <span className="text-xs text-slate-400 ml-auto">{filteredBacklinks.length} of {analysis.topBacklinks.length} shown (top 100)</span>
            </div>

            {/* Backlinks table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Source</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Anchor</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-600">DR</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Type</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">First Seen</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBacklinks.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-400">No backlinks match filters</td></tr>
                    ) : filteredBacklinks.map((bl, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <div className="font-medium text-slate-700 truncate">{bl.domain_from}</div>
                          <a href={bl.url_from} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:underline truncate block max-w-[180px]">
                            {bl.url_from.replace(/^https?:\/\//, '').slice(0, 50)}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 max-w-[160px]">
                          <span className="text-slate-700 italic truncate block">
                            {bl.anchor || <span className="text-slate-300">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rankBadge(bl.domain_from_rank)}`}>
                            {bl.domain_from_rank > 0 ? bl.domain_from_rank.toLocaleString() : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${bl.dofollow ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {bl.dofollow ? 'dofollow' : 'nofollow'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">
                          {bl.first_seen ? new Date(bl.first_seen).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {bl.is_new && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">New</span>}
                          {bl.is_lost && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-500">Lost</span>}
                          {!bl.is_new && !bl.is_lost && <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── REFERRING DOMAINS TAB ── */}
        {tab === 'Referring Domains' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-400">
              Top {analysis.topReferringDomains.length} referring domains by rank (of {fmt(analysis.referringDomains)} total)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Domain</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Rank</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Links</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Dofollow</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Spam</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">First Seen</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.topReferringDomains.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">No referring domains data</td></tr>
                  ) : analysis.topReferringDomains.map((rd, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <a href={`https://${rd.domain}`} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline">{rd.domain}</a>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rankBadge(rd.rank)}`}>
                          {rd.rank > 0 ? rd.rank.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-medium text-slate-700">{rd.backlinks}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{rd.dofollow}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${spamBadge(rd.spam_score ?? 0)}`}>
                          {rd.spam_score ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {rd.first_seen ? new Date(rd.first_seen).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {rd.is_new && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">New</span>}
                        {rd.is_lost && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-500">Lost</span>}
                        {!rd.is_new && !rd.is_lost && <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
