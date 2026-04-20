'use client'

import { useContent } from '@/context/ContentContext'
import { Card, Badge, ScoreBar, EmptyState } from '@/components/ui'
import { exportAICiteCSV, exportAICitePDF } from '@/lib/export'

export default function AICitePage() {
  const { analysisResult } = useContent()

  if (!analysisResult) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <EmptyState icon="🤖" title="No analysis yet" desc="Go to the Scores tab, paste content, and run an analysis first." />
      </div>
    )
  }

  const score = analysisResult.scores?.llm_citation_triggers ?? 0
  const tip = analysisResult.llm_citation_tip ?? ''
  const scoreColor = score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
  const verdict = score >= 75 ? { label: 'Likely Cited', variant: 'green' as const } :
                  score >= 50 ? { label: 'Possibly Cited', variant: 'amber' as const } :
                               { label: 'Unlikely Cited', variant: 'red' as const }

  const signals = [
    { label: 'Factual claims with citations', met: score >= 60 },
    { label: 'Clear definitions and explanations', met: score >= 50 },
    { label: 'Structured data / schema markup', met: (analysisResult.scores?.structured_data ?? 0) >= 60 },
    { label: 'Authority signals (author, credentials)', met: (analysisResult.scores?.authority_reinforcement ?? 0) >= 60 },
    { label: 'Semantic richness & entity coverage', met: (analysisResult.scores?.semantic_richness ?? 0) >= 60 },
    { label: 'E-E-A-T signals present', met: (analysisResult.scores?.eeat_signals ?? 0) >= 60 },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto fade-up space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-base font-black">AI Cite Score</h1>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={() => exportAICiteCSV(analysisResult as never)} style={{padding:'5px 12px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>⬇ CSV</button>
            <button onClick={() => exportAICitePDF(analysisResult as never)} style={{padding:'5px 12px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>⬇ PDF</button>
          </div>
        </div>

        {/* Score hero */}
        <Card className="flex items-center gap-6">
          <div className="text-center flex-shrink-0 w-24">
            <div className={`text-5xl font-black ${scoreColor}`}>{score}</div>
            <div className="text-xs text-slate-400 mt-1">/100</div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={verdict.variant}>{verdict.label}</Badge>
            </div>
            <p className="text-sm text-slate-600">
              {score >= 75
                ? 'Your content has strong signals for AI citation. ChatGPT and Perplexity are likely to cite this content in relevant queries.'
                : score >= 50
                ? 'Your content has moderate citation potential. Improving E-E-A-T signals and adding more factual claims will help.'
                : 'Your content needs improvement to be cited by AI models. Focus on factual density, structure, and authority signals.'}
            </p>
          </div>
        </Card>

        {/* Citation signals */}
        <Card>
          <h2 className="text-sm font-bold mb-4">Citation Signals Checklist</h2>
          <div className="space-y-3">
            {signals.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${s.met ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
                  {s.met ? '✓' : '✗'}
                </div>
                <span className={`text-sm ${s.met ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Score bar context */}
        <Card>
          <h2 className="text-sm font-bold mb-4">LLM Citation Score vs Other Dimensions</h2>
          <ScoreBar value={score} label="LLM Citation Triggers" weight="20% of total" />
          <ScoreBar value={analysisResult.scores?.eeat_signals ?? 0} label="E-E-A-T Signals" weight="15% of total" />
          <ScoreBar value={analysisResult.scores?.authority_reinforcement ?? 0} label="Authority Reinforcement" weight="5% of total" />
          <ScoreBar value={analysisResult.scores?.structured_data ?? 0} label="Structured Data" weight="5% of total" />
        </Card>

        {/* Tip */}
        {tip && (
          <Card className="bg-blue-50 border-blue-200">
            <h2 className="text-xs font-bold text-blue-700 mb-1 uppercase tracking-wider">💡 Top AI Citation Tip</h2>
            <p className="text-sm text-blue-800 leading-relaxed">{tip}</p>
          </Card>
        )}
      </div>
    </div>
  )
}
