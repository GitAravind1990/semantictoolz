'use client'

import { useState } from 'react'

type Issue = {
  issue: string
  category?: string
  impact?: 'high' | 'medium' | 'low'
  fix?: string
}

type FixerResult = {
  fixed_content: string
  applied_fixes: Array<{ issue: string; fix_applied: string; location: string }>
  changes_summary: string
  estimated_score_improvement: number
  original_content: string
}

export default function FixerPage() {
  const [content, setContent] = useState('')
  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<FixerResult | null>(null)
  const [loading, setLoading] = useState<'idle' | 'analysing' | 'fixing'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  async function handleAnalyse() {
    if (content.length < 50) {
      setError('Content must be at least 50 characters')
      return
    }
    setError(null)
    setLoading('analysing')
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to analyse')
      const found = (data.top_issues ?? []) as Issue[]
      setIssues(found)
      setSelectedIssues(new Set(found.map((_, i) => i)))
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading('idle')
    }
  }

  async function handleFix(mode: 'auto' | 'selective') {
    const issuesToFix = mode === 'auto'
      ? issues
      : issues.filter((_, i) => selectedIssues.has(i))

    if (issuesToFix.length === 0) {
      setError('Select at least one issue to fix')
      return
    }
    setError(null)
    setLoading('fixing')
    try {
      const res = await fetch('/api/fixer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, issues: issuesToFix, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fix content')
      setResult(data)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading('idle')
    }
  }

  function toggleIssue(i: number) {
    const next = new Set(selectedIssues)
    if (next.has(i)) next.delete(i); else next.add(i)
    setSelectedIssues(next)
  }

  function downloadFixed() {
    if (!result) return
    const blob = new Blob([result.fixed_content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fixed-content.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setContent('')
    setIssues([])
    setSelectedIssues(new Set())
    setResult(null)
    setStep(1)
    setError(null)
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🔧</span>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Issue Fixer</h1>
          <p className="text-sm text-slate-500">AI rewrites your content to fix SEO issues automatically</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-xs font-bold">
        <span className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1. Paste Content</span>
        <span className="text-slate-300">→</span>
        <span className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2. Review Issues</span>
        <span className="text-slate-300">→</span>
        <span className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3. Get Fixed Version</span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">Paste your content</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste article, blog post, or page content here (min 50 characters)..."
            className="w-full h-64 p-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-500">{content.length} characters</span>
            <button
              onClick={handleAnalyse}
              disabled={loading === 'analysing' || content.length < 50}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl"
            >
              {loading === 'analysing' ? 'Analysing…' : 'Find Issues →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Found {issues.length} issues</h2>
            <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-700">← Start over</button>
          </div>

          <div className="space-y-2 mb-6">
            {issues.map((iss, i) => (
              <label key={i} className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIssues.has(i)}
                  onChange={() => toggleIssue(i)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      iss.impact === 'high' ? 'bg-red-100 text-red-700' :
                      iss.impact === 'medium' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{iss.impact || 'medium'}</span>
                    <span className="text-sm font-bold text-slate-900">{iss.issue}</span>
                  </div>
                  {iss.fix && <p className="text-xs text-slate-500">Suggested: {iss.fix}</p>}
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleFix('auto')}
              disabled={loading === 'fixing'}
              className="flex-1 px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl"
            >
              {loading === 'fixing' ? 'Fixing…' : `🪄 Auto-Fix All ${issues.length} Issues`}
            </button>
            <button
              onClick={() => handleFix('selective')}
              disabled={loading === 'fixing' || selectedIssues.size === 0}
              className="flex-1 px-6 py-3 border border-brand-600 text-brand-600 hover:bg-brand-50 disabled:opacity-50 text-sm font-bold rounded-xl"
            >
              Fix Selected ({selectedIssues.size})
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && result && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-green-900">✓ Fixed {result.applied_fixes?.length || 0} issues</p>
                <p className="text-xs text-green-700 mt-1">{result.changes_summary}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-green-700">+{result.estimated_score_improvement}</div>
                <div className="text-xs text-green-600">est. score</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-500 mb-3">BEFORE</h3>
              <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-96 overflow-auto">{result.original_content}</div>
            </div>
            <div className="bg-white border-2 border-brand-500 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-brand-600 mb-3">AFTER (FIXED)</h3>
              <div className="text-sm text-slate-700 max-h-96 overflow-auto prose prose-sm" dangerouslySetInnerHTML={{ __html: result.fixed_content }} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Applied fixes</h3>
            <ul className="space-y-2 text-sm">
              {result.applied_fixes?.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <div>
                    <span className="font-semibold text-slate-900">{f.issue}</span>
                    <span className="text-slate-500"> — {f.fix_applied} <em>({f.location})</em></span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadFixed}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl"
            >
              ⬇ Download HTML
            </button>
            <button
              onClick={reset}
              className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl"
            >
              Fix Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}