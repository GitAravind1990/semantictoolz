'use client'

import { useState } from 'react'
import { exportRewriteCSV, exportRewritePDF, exportRewriteDOCX } from '@/lib/export'
import { Button, Card, Spinner, EmptyState, LockedState, Badge } from '@/components/ui'

export function RewriteClient({ unlocked = true }: { unlocked?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [result, setResult] = useState<{
    rewritten_content: string
    improvements: string[]
    framework_sections_applied: string[]
    eeat_applied?: { overall: number; summary: string; dimensions: Record<string, { score: number; finding: string }>; recommendations: string[] }
  } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'preview' | 'html'>('preview')

  if (!unlocked) return <LockedState tool="AI Rewrite" plan="Pro" />

  async function handleRewrite() {
    const contentEl = document.getElementById('rewrite-content') as HTMLTextAreaElement
    const content = contentEl?.value ?? ''
    if (content.length < 50) { setError('Paste content to rewrite'); return }

    setLoading(true)
    setError('')
    setStep('Step 1/2: Running E-E-A-T analysis…')

    try {
      const r = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      setStep('Step 2/2: Rewriting with framework…')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setResult(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rewrite failed')
    } finally {
      setLoading(false)
      setStep('')
    }
  }

  async function copyContent() {
    if (!result?.rewritten_content) return
    // Copy as plain text stripping HTML tags
    const plain = result.rewritten_content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    await navigator.clipboard.writeText(plain)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sectionLabels: Record<string, string> = {
    hook_intro: 'Hook Intro', definition_h2: 'Definition H2', bucket_brigades: 'Bucket Brigades',
    data_proof: 'Data Proof', internal_links: 'Internal Links', cta_placement: 'CTA', conclusion: 'Conclusion',
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✍️</span>
          <div>
            <h1 className="text-base font-black">AI Rewrite</h1>
            <p className="text-xs text-slate-500">High-performance SEO framework + E-E-A-T fixes applied automatically</p>
          </div>
          <Button className="ml-auto" onClick={handleRewrite} loading={loading}>
            {loading ? step : 'Rewrite Content'}
          </Button>
        </div>

        <textarea
          id="rewrite-content"
          rows={6}
          placeholder="Paste your content here to rewrite…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm resize-none focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}

        {result && (
          <div className="fade-up space-y-4">
            {/* E-E-A-T applied */}
            {result.eeat_applied?.overall && (
              <Card className="bg-blue-50 border-blue-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-2xl font-black text-blue-700">{result.eeat_applied.overall}</div>
                  <div>
                    <div className="text-xs font-bold text-blue-800">E-E-A-T Applied to Rewrite</div>
                    <div className="text-xs text-blue-600">{result.eeat_applied.summary}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {Object.entries(result.eeat_applied.dimensions ?? {}).map(([k, v]) => {
                    const sc = v.score >= 70 ? 'text-emerald-600' : v.score >= 40 ? 'text-amber-600' : 'text-red-600'
                    return (
                      <div key={k} className="bg-white rounded-lg p-2 text-center border border-blue-100">
                        <div className={`text-lg font-black ${sc}`}>{v.score}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{k.slice(0, 6)}</div>
                      </div>
                    )
                  })}
                </div>
                {result.eeat_applied.recommendations?.length > 0 && (
                  <div className="space-y-1">
                    {result.eeat_applied.recommendations.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex gap-2 text-xs text-blue-700"><span className="text-emerald-500 font-bold">✓</span>{r}</div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Framework sections */}
            {result.framework_sections_applied?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.framework_sections_applied.map(s => (
                  <Badge key={s} variant="green">✓ {sectionLabels[s] ?? s}</Badge>
                ))}
              </div>
            )}

            {/* Improvements */}
            {result.improvements?.length > 0 && (
              <Card className="bg-blue-50 border-blue-100">
                <div className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wider">Improvements Applied</div>
                {result.improvements.map((imp, i) => (
                  <div key={i} className="flex gap-2 text-sm mb-1.5"><span className="text-brand-600 font-bold flex-shrink-0">→</span><span>{imp}</span></div>
                ))}
              </Card>
            )}

            {/* Rewritten content */}
            <Card>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rewritten Content</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* View toggle */}
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                    <button onClick={() => setViewMode('preview')}
                      className={`px-3 py-1.5 font-bold transition-colors ${viewMode === 'preview' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                      Preview
                    </button>
                    <button onClick={() => setViewMode('html')}
                      className={`px-3 py-1.5 font-bold transition-colors ${viewMode === 'html' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                      HTML
                    </button>
                  </div>
                  <Button variant="secondary" size="sm" onClick={copyContent}>
                    {copied ? '✓ Copied!' : '📋 Copy'}
                  </Button>
                </div>
              </div>

              {viewMode === 'preview' ? (
                <div
                  className="prose prose-slate max-w-none text-sm leading-relaxed max-h-[600px] overflow-y-auto
                    [&_h1]:text-xl [&_h1]:font-black [&_h1]:text-slate-900 [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:leading-tight
                    [&_h2]:text-base [&_h2]:font-black [&_h2]:text-slate-800 [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-slate-100 [&_h2]:pb-1
                    [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-slate-700 [&_h3]:mt-4 [&_h3]:mb-1.5
                    [&_p]:text-slate-600 [&_p]:mb-3 [&_p]:leading-relaxed
                    [&_strong]:text-slate-800 [&_strong]:font-bold
                    [&_ul]:space-y-1 [&_ul]:mb-3 [&_ul]:pl-4
                    [&_li]:text-slate-600 [&_li]:list-disc
                    [&_ol]:space-y-1 [&_ol]:mb-3 [&_ol]:pl-4
                    [&_ol_li]:list-decimal"
                  dangerouslySetInnerHTML={{ __html: result.rewritten_content }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 font-mono max-h-[600px] overflow-y-auto bg-slate-50 p-3 rounded-lg">
                  {result.rewritten_content}
                </pre>
              )}
            </Card>

            {/* Export buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" size="sm" onClick={() => { setResult(null) }}>↺ Rewrite Again</Button>
              <button onClick={() => exportRewriteCSV(result.rewritten_content, result.improvements ?? [])}
                style={{padding:'6px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>⬇ CSV</button>
              <button onClick={() => exportRewritePDF(result.rewritten_content, result.improvements ?? [])}
                style={{padding:'6px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>⬇ PDF</button>
              <button onClick={() => exportRewriteDOCX(result.rewritten_content, result.improvements ?? [])}
                style={{padding:'6px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>⬇ Word</button>
            </div>
          </div>
        )}

        {!result && !loading && (
          <EmptyState icon="✍️" title="AI Rewrite" desc="Paste content above and click Rewrite. E-E-A-T is analysed first, then content is rewritten with proper H1/H2/H3 headings." />
        )}
      </div>
    </div>
  )
}
