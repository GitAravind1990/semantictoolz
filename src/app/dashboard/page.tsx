'use client'

import { useCallback } from 'react'
import { ToolRunner } from '@/components/tools/ToolRunner'
import { exportScoresCSV, exportScoresPDF } from '@/lib/export'
import { Card, ScoreBar, Badge, EmptyState } from '@/components/ui'
import { useContent } from '@/context/ContentContext'

const SCORE_DIMS = [
  { key: 'technical_seo',         label: 'Technical SEO',     weight: '10%' },
  { key: 'on_page_seo',           label: 'On-Page SEO',       weight: '20%' },
  { key: 'entity_optimization',   label: 'Entity Optim.',     weight: '15%' },
  { key: 'eeat_signals',          label: 'E-E-A-T Signals',   weight: '15%' },
  { key: 'semantic_richness',     label: 'Semantic Richness', weight: '10%' },
  { key: 'llm_citation_triggers', label: 'LLM Citation',      weight: '20%' },
  { key: 'structured_data',       label: 'Structured Data',   weight: '5%'  },
  { key: 'authority_reinforcement',label: 'Authority',        weight: '5%'  },
]

const GRADE_COLORS: Record<string,string> = { S:'text-purple-600', A:'text-emerald-600', B:'text-blue-600', C:'text-amber-600', D:'text-red-600' }

export default function DashboardPage() {
  const { analysisResult, setAnalysisResult, setContent } = useContent()

  const handleResult = useCallback((result: typeof analysisResult, content: string) => {
    setAnalysisResult(result)
    setContent(content)
  }, [setAnalysisResult, setContent])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ToolRunner onResult={handleResult} />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {!analysisResult ? (
          <EmptyState icon="◈" title="Ready to analyse" desc="Paste content or fetch a URL above, then click Analyse to get your full content score." />
        ) : (
          <div className="max-w-3xl mx-auto fade-up space-y-5">
            <Card className="flex items-center gap-5">
              <div className="text-center flex-shrink-0 w-20">
                <div className={`text-5xl font-black ${GRADE_COLORS[analysisResult.grade] ?? 'text-slate-900'}`}>{analysisResult.grade}</div>
                <div className="text-xs text-slate-400 mt-1">Grade</div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black">{analysisResult.overall_score}</span>
                  <span className="text-slate-400 text-sm">/100</span>
                </div>
                <p className="text-sm text-slate-600">{analysisResult.summary}</p>
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-bold text-slate-800 mb-4">Score Breakdown</h2>
              {SCORE_DIMS.map(d => (
                <ScoreBar key={d.key} value={analysisResult.scores?.[d.key] ?? 0} label={d.label} weight={d.weight} />
              ))}
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <h2 className="text-sm font-bold mb-3">Top Issues ({analysisResult.top_issues?.length ?? 0})</h2>
                <div className="space-y-2.5">
                  {(analysisResult.top_issues ?? []).slice(0, 5).map((issue, i) => (
                    <div key={i} className="flex gap-2.5">
                      <Badge variant={issue.impact === 'high' ? 'red' : issue.impact === 'medium' ? 'amber' : 'green'}>{issue.impact}</Badge>
                      <div>
                        <div className="text-xs font-bold">{issue.issue}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{issue.fix}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="text-sm font-bold mb-3">Quick Wins</h2>
                <div className="space-y-2 mb-4">
                  {(analysisResult.quick_wins ?? []).map((w, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="text-emerald-500 font-bold flex-shrink-0">→</span>
                      <span className="text-slate-700">{w}</span>
                    </div>
                  ))}
                </div>
                {analysisResult.entity_gaps?.length > 0 && (
                  <>
                    <h2 className="text-sm font-bold mb-2">Missing Entities</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.entity_gaps.map((e, i) => <Badge key={i} variant="purple">{e}</Badge>)}
                    </div>
                  </>
                )}
              </Card>
            </div>

            {analysisResult.llm_citation_tip && (
              <Card className="bg-blue-50 border-blue-200">
                <h2 className="text-xs font-bold text-blue-700 mb-1">💡 LLM Citation Tip</h2>
                <p className="text-sm text-blue-800">{analysisResult.llm_citation_tip}</p>
              </Card>
            )}
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              <button onClick={() => exportScoresCSV(analysisResult as never)} style={{padding:'7px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>⬇ CSV</button>
              <button onClick={() => exportScoresPDF(analysisResult as never)} style={{padding:'7px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>⬇ PDF</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
