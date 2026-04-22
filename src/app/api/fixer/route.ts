import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callClaude, extractJSON } from '@/lib/anthropic'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM = `You are an expert SEO editor. Your job is to rewrite content to fix specific issues while keeping the original voice, topic, and facts intact.

Return ONLY valid JSON in this exact format:
{
  "fixed_content": "<p>rewritten HTML content here</p>",
  "applied_fixes": [
    {"issue": "", "fix_applied": "", "location": ""}
  ],
  "changes_summary": "",
  "estimated_score_improvement": 0
}

Rules:
- fixed_content: Full rewritten content as HTML. Use <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>. NO markdown.
- applied_fixes: One entry per issue you fixed. location = "intro", "section 2", "conclusion", etc.
- changes_summary: 1-2 sentence overview of what changed.
- estimated_score_improvement: Number between 5 and 40 (how many points the content score should improve).
- Keep all facts, statistics, and specific details from the original.
- Do not invent new data or claims.
- Preserve the original language and general length.`

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('fixer')
    const { content, issues, mode } = await req.json()

    if (!content || content.length < 50) {
      return apiError({ message: 'Content too short (min 50 chars)', status: 400, name: 'ValidationError' })
    }
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return apiError({ message: 'At least one issue is required', status: 400, name: 'ValidationError' })
    }

    const issuesList = issues.slice(0, 10).map((i: { issue: string; fix?: string; impact?: string }, idx: number) => 
      `${idx + 1}. [${i.impact || 'medium'}] ${i.issue}${i.fix ? ` — Suggested fix: ${i.fix}` : ''}`
    ).join('\n')

    const prompt = `Fix the following issues in this content. Mode: ${mode || 'auto'}.

ISSUES TO FIX:
${issuesList}

ORIGINAL CONTENT:
${content.slice(0, 4000)}

Rewrite the content to fix every issue listed above. Keep facts intact. Return JSON only.`

    const raw = await callClaude(SYSTEM, prompt, 4000, 'claude-haiku-4-5-20251001')
    const result = extractJSON(raw)

    return apiSuccess({ ...result, userPlan: user.plan, mode: mode || 'auto', original_content: content })
  } catch (e) {
    return apiError(e)
  }
}