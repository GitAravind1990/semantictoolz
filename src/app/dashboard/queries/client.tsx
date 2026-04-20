'use client'

import { ProToolPage } from '@/components/tools/ProToolPage'
import { exportQueriesCSV, exportQueriesPDF } from '@/lib/export'
import { Card, Badge } from '@/components/ui'

export function QueriesClient({ unlocked }: { unlocked: boolean }) {
  return (
    <ProToolPage
      toolId="queries"
      title="AI Queries"
      icon="🔎"
      description="Map the AI search queries your content should answer — with coverage scores and fixes"
      plan="Pro"
      unlocked={unlocked}
      needsContent
      getBody={(content, summary) => ({ content, summary })}
      renderResult={(data) => {
        const d = data as { summary: string; queries: Array<{ query: string; intent: string; coverage: string; why: string; fix: string }> }
        return (
          <div className="space-y-3">
            {d.summary && <Card className="bg-slate-50"><p className="text-sm text-slate-600">{d.summary}</p></Card>}
            {(d.queries ?? []).map((q, i) => (
              <Card key={i}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-sm">{q.query}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Badge variant={q.coverage === 'strong' ? 'green' : q.coverage === 'partial' ? 'amber' : 'red'}>{q.coverage}</Badge>
                    <Badge variant="gray">{q.intent}</Badge>
                  </div>
                </div>
                {q.why && <p className="text-xs text-slate-500 mb-1">{q.why}</p>}
                {q.fix && <p className="text-xs text-blue-600">Fix: {q.fix}</p>}
              </Card>
            ))}
          </div>
        )
      }}
    />
  )
}
