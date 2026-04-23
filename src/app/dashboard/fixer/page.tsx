'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useContent } from '@/context/ContentContext'

type Issue = {
  issue: string
  category?: string
  impact?: 'high' | 'medium' | 'low'
  fix?: string
}

type AuthorProfile = {
  name: string
  title: string
  credentials: string
  experience: string
  reviewer_name: string
  reviewer_credentials: string
}

type FixerResult = {
  fixed_content: string
  applied_fixes: Array<{ issue: string; fix_applied: string; location: string }>
  changes_summary: string
  estimated_score_improvement: number
  original_content: string
  original_word_count?: number
  new_word_count?: number
  length_ratio?: number
}

const EMPTY_AUTHOR: AuthorProfile = {
  name: '', title: '', credentials: '', experience: '', reviewer_name: '', reviewer_credentials: '',
}

export default function FixerPage() {
  const { content: sharedContent, analysisResult } = useContent()
  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set())
  const [author, setAuthor] = useState<AuthorProfile>(EMPTY_AUTHOR)
  const [result, setResult] = useState<FixerResult | null>(null)
  const [loading, setLoading] = useState<'idle' | 'fixing' | 'docx'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Load issues from Scores tab
  useEffect(() => {
    if (analysisResult?.top_issues?.length) {
      const found = analysisResult.top_issues as Issue[]
      setIssues(found)
      setSelectedIssues(new Set(found.map((_, i) => i)))
    }
  }, [analysisResult])

  const hasContent = !!sharedContent && sharedContent.length >= 50
  const hasIssues = issues.length > 0

  async function handleFix(mode: 'auto' | 'selective') {
    if (!sharedContent) {
      setError('Please analyze content in the Content Analyzer first.')
      return
    }
    const issuesToFix = mode === 'auto' ? issues : issues.filter((_, i) => selectedIssues.has(i))
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
        body: JSON.stringify({
          content: sharedContent,
          issues: issuesToFix,
          mode,
          author: author.name || author.reviewer_name ? author : undefined,
        }),
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

  function downloadHTML() {
    if (!result) return
    const blob = new Blob([result.fixed_content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fixed-content.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadDOCX() {
    if (!result) return
    setLoading('docx')
    try {
      const res = await fetch('/api/fixer-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: result.fixed_content, filename: 'fixed-content' }),
      })
      if (!res.ok) throw new Error('DOCX generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'fixed-content.docx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DOCX download failed')
    } finally {
      setLoading('idle')
    }
  }

  function reset() {
    setResult(null)
    setStep(1)
    setError(null)
  }

  // Not yet analyzed — ask user to go to Content Analyzer
  if (!hasContent || !hasIssues) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 pb-24">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🔧</span>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Issue Fixer</h1>
              <p className="text-sm text-slate-500">AI rewrites your content to fix SEO issues automatically</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">No analyzed content yet</h2>
            <p className="text-sm text-slate-600 mb-4">
              The Issue Fixer works with content and issues from the <strong>Content Analyzer</strong>. Run an analysis first, then come back here.
            </p>
            <Link
              href="/dashboard/scores"
              className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
            >
              Go to Content Analyzer →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🔧</span>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Issue Fixer</h1>
            <p className="text-sm text-slate-500">AI rewrites your content to fix SEO issues automatically</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 text-xs font-bold">
          <span className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1. Author Info</span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2. Review & Fix</span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3. Fixed Version</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {/* Step 1: Author profile form */}
        {step === 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Author profile (optional but recommended)</h2>
              <p className="text-xs text-slate-500 mt-1">
                Providing real author info ensures E-E-A-T fixes use YOUR credentials instead of inventing them. Leave blank to use a generic &quot;Editorial Team&quot; byline.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Author name" placeholder="Dr. Jane Doe" value={author.name} onChange={v => setAuthor({ ...author, name: v })} />
              <Field label="Author title / role" placeholder="Senior Fertility Specialist" value={author.title} onChange={v => setAuthor({ ...author, title: v })} />
              <Field label="Credentials" placeholder="MBBS, MD (Obstetrics & Gynaecology)" value={author.credentials} onChange={v => setAuthor({ ...author, credentials: v })} />
              <Field label="Experience" placeholder="15+ years in reproductive medicine" value={author.experience} onChange={v => setAuthor({ ...author, experience: v })} />
              <Field label="Medical reviewer name" placeholder="Dr. John Smith" value={author.reviewer_name} onChange={v => setAuthor({ ...author, reviewer_name: v })} />
              <Field label="Reviewer credentials" placeholder="MD, DGO, Fellow RCOG" value={author.reviewer_credentials} onChange={v => setAuthor({ ...author, reviewer_credentials: v })} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setAuthor(EMPTY_AUTHOR)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear all
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
              >
                Continue to issues →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review issues + fix */}
        {step === 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Found {issues.length} issues</h2>
              <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-slate-700">← Back to author</button>
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

            <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleFix('auto')}
                disabled={loading === 'fixing'}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl"
              >
                {loading === 'fixing' ? 'Fixing…' : `🪄 Auto-Fix All ${issues.length} Issues`}
              </button>
              <button
                onClick={() => handleFix('selective')}
                disabled={loading === 'fixing' || selectedIssues.size === 0}
                className="flex-1 px-6 py-3 border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50 text-sm font-bold rounded-xl"
              >
                Fix Selected ({selectedIssues.size})
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && result && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-900">✓ Fixed {result.applied_fixes?.length || 0} issues</p>
                  <p className="text-xs text-green-700 mt-1">{result.changes_summary}</p>
                  {result.original_word_count && result.new_word_count && (
                    <p className="text-xs text-green-700 mt-1">
                      Length: {result.original_word_count} → {result.new_word_count} words
                      {typeof result.length_ratio === 'number' && ` (${result.length_ratio}% of original)`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-green-700">+{result.estimated_score_improvement}</div>
                  <div className="text-xs text-green-600">est. score</div>
                </div>
              </div>
            </div>

            {result.length_ratio !== undefined && result.length_ratio < 90 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                ⚠ The fixed version is shorter than 90% of the original. Click &quot;Fix Another&quot; and try running again if this isn&apos;t what you wanted.
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-500 mb-3">BEFORE</h3>
                <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-96 overflow-auto">{result.original_content}</div>
              </div>
              <div className="bg-white border-2 border-blue-500 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-blue-600 mb-3">AFTER (FIXED)</h3>
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

            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadDOCX}
                disabled={loading === 'docx'}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl"
              >
                {loading === 'docx' ? 'Generating…' : '⬇ Download DOCX'}
              </button>
              <button
                onClick={downloadHTML}
                className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl"
              >
                ⬇ Download HTML
              </button>