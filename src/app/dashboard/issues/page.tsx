'use client'

import { useContent } from '@/context/ContentContext'
import { Card, Badge, EmptyState } from '@/components/ui'
import { exportIssuesCSV, exportIssuesPDF } from '@/lib/export'

export default function IssuesPage() {
  const { analysisResult } = useContent()

  if (!analysisResult) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <EmptyState icon="🔍" title="No analysis yet" desc="Go to the Scores tab, paste content, and run an analysis first." />
      </div>
    )
  }

  const issues = analysisResult.top_issues ?? []

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto fade-up space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-black">Content Issues</h1>
          <Badge variant={issues.length > 5 ? 'red' : issues.length > 2 ? 'amber' : 'green'}>
            {issues.length} issues found
          </Badge>
        </div>

        {issues.length === 0 ? (
          <Card className="text-center py-10">
            <div className="text-3xl mb-3">🎉</div>
            <p className="font-bold">No critical issues found</p>
            <p className="text-sm text-slate-500 mt-1">Your content is in good shape.</p>
          </Card>
        ) : (
          issues.map((issue, i) => (
            <Card key={i} className={`border-l-4 ${issue.impact === 'high' ? 'border-l-red-400' : issue.impact === 'medium' ? 'border-l-amber-400' : 'border-l-blue-400'}`}>
              <div className="flex items-start gap-3 mb-2">
                <Badge variant={issue.impact === 'high' ? 'red' : issue.impact === 'medium' ? 'amber' : 'blue'}>
                  {issue.impact}
                </Badge>
                <span className="font-bold text-sm flex-1">{issue.issue}</span>
                <span className="text-xs text-slate-400 flex-shrink-0">{issue.category}</span>
              </div>
              {issue.fix && (
                <div className="flex gap-2 text-sm ml-16">
                  <span className="text-brand-600 font-bold flex-shrink-0">Fix:</span>
                  <span className="text-slate-600">{issue.fix}</span>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
