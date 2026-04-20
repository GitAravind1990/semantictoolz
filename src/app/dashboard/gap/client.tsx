'use client'

import { ProToolPage } from '@/components/tools/ProToolPage'
import { exportGapCSV, exportGapPDF } from '@/lib/export'
import { Card, Badge } from '@/components/ui'

export function GapClient({ unlocked }: { unlocked: boolean }) {
  return (
    <ProToolPage
      toolId="gap"
      title="Content Gap"
      icon="🕳️"
      description="Identify topics your competitors cover that you don't — ranked by traffic opportunity"
      plan="Pro"
      unlocked={unlocked}
      needsContent
      getBody={(content, summary) => ({ content, summary })}
      renderResult={(data) => {
        const d = data as { summary: string; gaps: Array<{ title: string; why: string; opportunity: string; suggested_section: string }> }
        return (
          <div className="space-y-3">
            {d.summary && <Card className="bg-slate-50"><p className="text-sm text-slate-600">{d.summary}</p></Card>}
            {(d.gaps ?? []).map((gap, i) => (
              <Card key={i}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-sm">{gap.title}</span>
                  <Badge variant={gap.opportunity === 'high' ? 'red' : gap.opportunity === 'medium' ? 'amber' : 'gray'}>{gap.opportunity}</Badge>
                </div>
                <p className="text-xs text-slate-600 mb-1">{gap.why}</p>
                {gap.suggested_section && <p className="text-xs text-blue-600">Add to: {gap.suggested_section}</p>}
              </Card>
            ))}
          </div>
        )
      }}
    />
  )
}
