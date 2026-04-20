'use client'

import { useContent } from '@/context/ContentContext'
import { Card, Badge, EmptyState } from '@/components/ui'
import { exportEntitiesCSV, exportEntitiesPDF } from '@/lib/export'

export default function EntitiesPage() {
  const { analysisResult } = useContent()

  if (!analysisResult) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <EmptyState icon="🔗" title="No analysis yet" desc="Go to the Scores tab, paste content, and run an analysis first." />
      </div>
    )
  }

  const gaps = analysisResult.entity_gaps ?? []
  const wins = analysisResult.quick_wins ?? []

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto fade-up space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h1 className="text-base font-black">Entity Gaps</h1>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={() => exportEntitiesCSV(gaps, wins)} style={{padding:'5px 12px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>⬇ CSV</button>
            <button onClick={() => exportEntitiesPDF(gaps, wins)} style={{padding:'5px 12px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>⬇ PDF</button>
          </div>
        </div>

        <Card>
          <h2 className="text-sm font-bold mb-3">Missing Entities ({gaps.length})</h2>
          <p className="text-xs text-slate-500 mb-4">
            These entities are expected for this topic but absent from your content. Adding them improves semantic richness and LLM citation likelihood.
          </p>
          {gaps.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {gaps.map((e, i) => (
                <Badge key={i} variant="purple">{e}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No entity gaps found — good coverage.</p>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold mb-3">Quick Wins</h2>
          <div className="space-y-2">
            {wins.map((w, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-emerald-500 font-bold flex-shrink-0">→</span>
                <span className="text-slate-700">{w}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
