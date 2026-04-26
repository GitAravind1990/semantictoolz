'use client'

import { useState } from 'react'
import { useContent } from '@/context/ContentContext'
import Link from 'next/link'

type FixType = 'entities' | 'citations' | 'eeat' | 'semantic' | 'technical'

interface AppliedFix {
  issue: string
  [key: string]: string
}

interface OptimizerResult {
  optimized_content: string
  applied_fixes: AppliedFix[]
  changes_summary: string
  original_word_count: number
  new_word_count: number
  length_ratio: number
  meets_requirement: boolean
  status_message: string
  fix_types_applied: FixType[]
}

const FIX_TYPE_INFO: Record<FixType, { label: string; description: string; icon: string }> = {
  entities: {
    label: 'Entity Definitions',
    description: 'Add definitions for undefined terms and concepts',
    icon: '📚'
  },
  citations: {
    label: 'Citation Attribution',
    description: 'Add sources and attributions to unsourced claims',
    icon: '📎'
  },
  eeat: {
    label: 'E-E-A-T Signals',
    description: 'Inject author credentials and expertise signals',
    icon: '🏆'
  },
  semantic: {
    label: 'Semantic Richness',
    description: 'Expand vague claims with context and details',
    icon: '🔍'
  },
  technical: {
    label: 'Technical SEO',
    description: 'Add meta tags, schema markup, and structure suggestions',
    icon: '⚙️'
  }
}

export default function OptimizerPage() {
  const { content: sharedContent, analysisResult } = useContent()
  const [selectedFixTypes, setSelectedFixTypes] = useState<Set<FixType>>(
    new Set(['entities', 'citations', 'eeat', 'semantic', 'technical'])
  )
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [showUpgradePopup, setShowUpgradePopup] = useState(false)

  const hasContent = !!sharedContent && sharedContent.length >= 50
  const hasIssues = analysisResult?.top_issues && analysisResult.top_issues.length > 0

  function toggleFixType(type: FixType) {
    const next = new Set(selectedFixTypes)
    if (next.has(type)) {
      next.delete(type)
    } else {
      next.add(type)
    }
    setSelectedFixTypes(next)
  }

  async function handleOptimize() {
    if (!sharedContent) {
      setError('Please analyze content in Content Analyzer first.')
      return
    }
    if (selectedFixTypes.size === 0) {
      setError('Select at least one fix type.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: sharedContent,
          issues: analysisResult?.top_issues || [],
          selectedFixTypes: Array.from(selectedFixTypes),
          author: {
            name: 'Author Name',
            credentials: 'Credentials'
          }
        })
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMsg = data.error || 'Optimization failed'
        // Show upgrade popup if it's a plan restriction
        if (errorMsg.includes('higher plan') || errorMsg.includes('upgrade') || res.status === 403) {
          setShowUpgradePopup(true)
        } else {
          setError(errorMsg)
        }
        return
      }

      setResult(data)
      setStep(2)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Something went wrong'
      if (errorMsg.includes('higher plan') || errorMsg.includes('upgrade')) {
        setShowUpgradePopup(true)
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  function downloadHTML() {
    if (!result) return
    const blob = new Blob([result.optimized_content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'optimized-content.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadText() {
    if (!result) return
    const text = result.optimized_content.replace(/<[^>]+>/g, '')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'optimized-content.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setResult(null)
    setStep(1)
    setError(null)
  }

  if (!hasContent) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">⚡</span>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Content Optimizer</h1>
              <p className="text-sm text-slate-500">Transform your content with intelligent fixes</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">No analyzed content yet</h2>
            <p className="text-sm text-slate-600 mb-4">Go to Content Analyzer first to detect issues, then come back here.</p>
            <a href="/dashboard/scores" className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl">
              Go to Content Analyzer →
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!hasIssues) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">⚡</span>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Content Optimizer</h1>
              <p className="text-sm text-slate-500">Transform your content with intelligent fixes</p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">No issues detected</h2>
            <p className="text-sm text-slate-600 mb-4">Your content is in great shape! Run Content Analyzer again or analyze different content.</p>
            <a href="/dashboard/scores" className="inline-block px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl">
              Analyze Different Content →
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">⚡</span>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Content Optimizer</h1>
            <p className="text-sm text-slate-500">Intelligent fixes for any industry, any content type</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 text-xs font-bold">
          <span className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1. Select Fixes</span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2. Review</span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3. Download</span>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        {/* Step 1: Select Fix Types */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Select Optimization Types</h2>
              <p className="text-sm text-slate-600 mb-4">Choose which types of fixes to apply to your content:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(Object.keys(FIX_TYPE_INFO) as FixType[]).map((type) => (
                  <label key={type} className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFixTypes.has(type)}
                      onChange={() => toggleFixType(type)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{FIX_TYPE_INFO[type].icon}</span>
                        <span className="font-bold text-slate-900">{FIX_TYPE_INFO[type].label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{FIX_TYPE_INFO[type].description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {analysisResult?.top_issues && analysisResult.top_issues.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Issues to Fix ({analysisResult.top_issues.length})</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analysisResult.top_issues.map((issue: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="font-bold text-slate-900">[{issue.category}]</span> {issue.issue}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-200 flex gap-3">
              <Link
                href="/dashboard/scores"
                className="flex-1 px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl"
              >
                ← Back
              </Link>
              <button
                onClick={handleOptimize}
                disabled={loading || selectedFixTypes.size === 0}
                className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl"
              >
                {loading ? 'Optimizing...' : `Optimize Content (${selectedFixTypes.size} types)`}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review Results */}
        {step === 2 && result && (
          <div className="space-y-6">
            <div className={`${result.meets_requirement ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-2xl p-4`}>
              <p className={`text-sm font-bold ${result.meets_requirement ? 'text-green-900' : 'text-yellow-900'}`}>
                {result.status_message}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Optimization Results</h3>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{result.original_word_count}</p>
                  <p className="text-xs text-slate-500">Original Words</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">→</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{result.new_word_count}</p>
                  <p className="text-xs text-slate-500">Optimized Words ({result.length_ratio}%)</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-bold text-slate-900 mb-3">Applied Fixes ({result.applied_fixes.length})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {result.applied_fixes.map((fix: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-green-50 border border-green-200 rounded">
                      ✓ {fix.issue}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
              >
                View & Download →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: View & Download */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-green-900">✓ Content optimized successfully</p>
              <p className="text-xs text-green-700 mt-1">Review your optimized content below and download in your preferred format.</p>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
              <pre>{result.optimized_content.substring(0, 2000)}...</pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadHTML}
                className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
              >
                ⬇ Download HTML
              </button>
              <button
                onClick={downloadText}
                className="flex-1 px-6 py-2.5 border border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-bold rounded-xl"
              >
                ⬇ Download TXT
              </button>
              <button
                onClick={reset}
                className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl"
              >
                Optimize Again
              </button>
            </div>
          </div>
        )}

        {/* Upgrade Popup Modal */}
        {showUpgradePopup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="text-center">
                <div className="text-5xl mb-4">⚡</div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Upgrade to PRO</h3>
                <p className="text-slate-600 mb-6">
                  Content Optimizer is a PRO feature. Upgrade to unlock automatic content fixing for any business or industry.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm font-bold text-blue-900 mb-2">PRO Features:</p>
                  <ul className="text-sm text-slate-700 text-left space-y-1">
                    <li>✅ 50 analyses/month</li>
                    <li>✅ ⚡ Content Optimizer (auto-fix issues)</li>
                    <li>✅ E-E-A-T deep analysis</li>
                    <li>✅ Relevant Backlinks finder</li>
                    <li>✅ AI content rewriter</li>
                    <li>✅ Citation strategy engine</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpgradePopup(false)}
                    className="flex-1 px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl"
                  >
                    Maybe Later
                  </button>
                  
                  <Link
                    href="/pricing"
                    className="flex-1 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white text-sm font-bold rounded-xl text-center"
                  >
                    Upgrade Now →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}