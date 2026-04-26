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