'use client'

import { useState } from 'react'
import { Button, Card, Badge, EmptyState, LockedState } from '@/components/ui'
import { exportKeywordResearchCSV, exportKeywordResearchPDF } from '@/lib/export'

type KWResult = {
  seed: string
  summary: string
  primary_keywords: Array<{ keyword: string; intent: string; volume: string; difficulty: string; opportunity: string; notes: string }>
  longtail: Array<{ keyword: string; intent: string; difficulty: string; angle: string }>
  questions: string[]
  clusters: Array<{ theme: string; description: string; keywords: string[] }>
  content_gaps: string[]
}

const INTENT_COLORS: Record<string, 'blue' | 'green' | 'amber' | 'purple'> = {
  informational: 'blue',
  commercial: 'green',
  transactional: 'amber',
  navigational: 'purple',
}

const DIFF_COLORS: Record<string, 'green' | 'amber' | 'red'> = {
  easy: 'green',
  medium: 'amber',
  hard: 'red',
}

const VOL_COLORS: Record<string, 'green' | 'amber' | 'gray'> = {
  high: 'green',
  medium: 'amber',
  low: 'gray',
}

export function KeywordResearchClient({ unlocked = true }: { unlocked?: boolean }) {
  const [keyword, setKeyword] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<KWResult | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'primary' | 'longtail' | 'questions' | 'clusters'>('primary')

  if (!unlocked) return <LockedState tool="Keyword Research" plan="Pro" />

  async function handleRun() {
    if (keyword.trim().length < 2) { setError('Enter a seed keyword'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/keyword-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, context }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setResult(d)
      setTab('primary')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Research failed')
    } finally { setLoading(false) }
  }

  const tabs = [
    { id: 'primary' as const, label: 'Primary', count: result?.primary_keywords?.length },
    { id: 'longtail' as const, label: 'Long-tail', count: result?.longtail?.length },
    { id: 'questions' as const, label: 'Questions', count: result?.questions?.length },
    { id: 'clusters' as const, label: 'Clusters', count: result?.clusters?.length },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔑</span>
          <div>
            <h1 className="text-base font-black">Keyword Research</h1>
            <p className="text-xs text-slate-500">AI-powered keyword clusters, long-tail variations, and content angles</p>
          </div>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRun()}
            placeholder="Enter seed keyword (e.g. content marketing strategy)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex gap-3">
            <input
              type="text"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Optional: niche or target audience (e.g. B2B SaaS companies)"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button onClick={handleRun} loading={loading}>Research</Button>
          </div>
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}

        {result && (
          <div className="fade-up space-y-4">
            {/* Summary */}
            <Card className="bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Research Summary — "{result.seed}"</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => exportKeywordResearchCSV(result)} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>⬇ CSV</button>
                  <button onClick={() => exportKeywordResearchPDF(result)} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>⬇ PDF</button>
                </div>
              </div>
              <p className="text-sm text-slate-600">{result.summary}</p>
            </Card>

            {/* Tabs */}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 px-3 py-2 font-bold transition-colors ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  {t.label} {t.count != null && <span className="opacity-60">({t.count})</span>}
                </button>
              ))}
            </div>

            {/* Primary keywords */}
            {tab === 'primary' && (
              <div className="space-y-3">
                {(result.primary_keywords ?? []).map((kw, i) => (
                  <Card key={i}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-bold text-sm">{kw.keyword}</span>
                      <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <Badge variant={INTENT_COLORS[kw.intent] ?? 'gray'}>{kw.intent}</Badge>
                        <Badge variant={VOL_COLORS[kw.volume] ?? 'gray'}>vol: {kw.volume}</Badge>
                        <Badge variant={DIFF_COLORS[kw.difficulty] ?? 'gray'}>diff: {kw.difficulty}</Badge>
                        {kw.opportunity === 'high' && <Badge variant="green">🎯 high opp</Badge>}
                      </div>
                    </div>
                    {kw.notes && <p className="text-xs text-slate-500">{kw.notes}</p>}
                  </Card>
                ))}
              </div>
            )}

            {/* Long-tail */}
            {tab === 'longtail' && (
              <div className="space-y-3">
                {(result.longtail ?? []).map((kw, i) => (
                  <Card key={i}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-bold text-sm">{kw.keyword}</span>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Badge variant={INTENT_COLORS[kw.intent] ?? 'gray'}>{kw.intent}</Badge>
                        <Badge variant={DIFF_COLORS[kw.difficulty] ?? 'gray'}>{kw.difficulty}</Badge>
                      </div>
                    </div>
                    {kw.angle && <p className="text-xs text-blue-600">→ {kw.angle}</p>}
                  </Card>
                ))}
              </div>
            )}

            {/* Questions */}
            {tab === 'questions' && (
              <div className="space-y-2">
                {(result.questions ?? []).map((q, i) => (
                  <Card key={i} className="flex items-center gap-3">
                    <span className="text-blue-500 font-bold flex-shrink-0">?</span>
                    <span className="text-sm">{q}</span>
                  </Card>
                ))}
                {result.content_gaps?.length > 0 && (
                  <>
                    <div className="pt-2 pb-1">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Content Gaps to Cover</div>
                    </div>
                    {result.content_gaps.map((gap, i) => (
                      <Card key={i} className="flex items-center gap-3 bg-amber-50 border-amber-100">
                        <span className="text-amber-500 font-bold flex-shrink-0">!</span>
                        <span className="text-sm">{gap}</span>
                      </Card>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Clusters */}
            {tab === 'clusters' && (
              <div className="space-y-4">
                {(result.clusters ?? []).map((cluster, i) => (
                  <Card key={i}>
                    <div className="mb-2">
                      <div className="font-black text-sm">{cluster.theme}</div>
                      {cluster.description && <p className="text-xs text-slate-500 mt-0.5">{cluster.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(cluster.keywords ?? []).map((kw, j) => (
                        <Badge key={j} variant="blue">{kw}</Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Re-run */}
            <Button variant="secondary" size="sm" onClick={() => setResult(null)}>↺ New Research</Button>
          </div>
        )}

        {!result && !loading && (
          <EmptyState icon="🔑" title="Keyword Research" desc="Enter a seed keyword above to get primary keywords, long-tail variations, question keywords, and topical clusters." />
        )}
      </div>
    </div>
  )
}
