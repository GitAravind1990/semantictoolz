'use client'

import { ProToolPage } from '@/components/tools/ProToolPage'
import { exportCitationCSV, exportCitationPDF } from '@/lib/export'
import { Card, Badge } from '@/components/ui'

export function CitationClient({ unlocked }: { unlocked: boolean }) {
  return (
    <ProToolPage
      toolId="citation"
      title="Citation Plan"
      icon="📎"
      description="AI citation strategy — build a plan to get cited by ChatGPT, Perplexity and Google AI Overviews"
      plan="Pro"
      unlocked={unlocked}
      needsContent
      getBody={(content, summary) => ({ content, summary })}
      renderResult={(data) => {
        const d = data as { summary: string; plan: Array<{ title: string; action: string; why: string; impact: string; effort: string }> }
        return (
          <div className="space-y-3">
            {d.summary && <Card className="bg-slate-50"><p className="text-sm text-slate-600">{d.summary}</p></Card>}
            {(d.plan ?? []).map((item, i) => (
              <Card key={i}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-sm">{item.title}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Badge variant={item.impact === 'high' ? 'green' : item.impact === 'medium' ? 'amber' : 'gray'}>{item.impact}</Badge>
                    <Badge variant="gray">{item.effort}</Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mb-1">{item.action}</p>
                {item.why && <p className="text-xs text-slate-400">{item.why}</p>}
              </Card>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => exportCitationCSV(d)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>⬇ CSV</button>
              <button onClick={() => exportCitationPDF(d)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>⬇ PDF</button>
            </div>
          </div>
        )
      }}
    />
  )
}
