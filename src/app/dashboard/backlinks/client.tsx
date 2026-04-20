'use client'

import { ProToolPage } from '@/components/tools/ProToolPage'
import { exportBacklinksCSV, exportBacklinksPDF, exportBacklinksDOCX } from '@/lib/export'
import { Card, Badge } from '@/components/ui'

const LINK_TYPE_COLORS: Record<string, 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'gray'> = {
  guest_post: 'blue', resource_page: 'green', journalist_pitch: 'amber',
  directory: 'purple', podcast: 'red', broken_link: 'red', partnership: 'blue',
}

export function BacklinksClient({ unlocked }: { unlocked: boolean }) {
  return (
    <ProToolPage
      toolId="backlinks"
      title="Relevant Backlinks"
      icon="🔗"
      description="Real site-specific link building opportunities with pitch angles and contact approaches"
      plan="Pro"
      unlocked={unlocked}
      needsContent
      getBody={(content, summary) => ({ content, summary })}
      renderResult={(data) => {
        const d = data as { summary: string; opportunities: Array<{ site_name: string; site_url: string; domain_authority: string; link_type: string; angle: string; why_relevant: string; contact_approach: string; difficulty: string; impact: string }> }
        return (<>
          <div className="space-y-4">
            {d.summary && <Card className="bg-slate-50"><p className="text-sm text-slate-600">{d.summary}</p></Card>}
            <div className="space-y-3">
              {(d.opportunities ?? []).map((op, i) => (
                <Card key={i}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">🔗</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-sm">{op.site_name}</span>
                        {op.site_url && (
                          <a href={`https://${op.site_url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline opacity-70">
                            {op.site_url} ↗
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant={LINK_TYPE_COLORS[op.link_type] ?? 'gray'}>{op.link_type?.replace(/_/g, ' ')}</Badge>
                        <Badge variant={op.domain_authority === 'high' ? 'green' : 'amber'}>DA: {op.domain_authority}</Badge>
                        <Badge variant="gray">difficulty: {op.difficulty}</Badge>
                        <Badge variant={op.impact === 'high' ? 'green' : 'gray'}>impact: {op.impact}</Badge>
                      </div>
                    </div>
                  </div>
                  {op.angle && <p className="text-xs font-semibold mb-1">📝 Angle: {op.angle}</p>}
                  {op.why_relevant && <p className="text-xs text-slate-500 mb-2">Why relevant: {op.why_relevant}</p>}
                  {op.contact_approach && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                      📬 {op.contact_approach}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:'8px',marginTop:'12px',flexWrap:'wrap'}}>
            <button onClick={() => exportBacklinksCSV(data as never)} style={{padding:'7px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>⬇ CSV</button>
            <button onClick={() => exportBacklinksPDF(data as never)} style={{padding:'7px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>⬇ PDF</button>
            <button onClick={() => exportBacklinksDOCX(data as never)} style={{padding:'7px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>⬇ Word</button>
          </div>
        </>)
      }}
    />
  )
}
