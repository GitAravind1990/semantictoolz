import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callClaude, extractJSON } from '@/lib/anthropic'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM = `You are an expert SEO editor. Your job is to rewrite content to fix specific issues while keeping the original voice, topic, and facts intact.

Output format (follow EXACTLY):

Step 1: Write the full rewritten content as HTML. Use <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>. NO markdown. NO code fences.

Step 2: On a new line, write exactly this delimiter: ===FIXER_META===

Step 3: Write valid JSON with this shape:
{"applied_fixes":[{"issue":"","fix_applied":"","location":""}],"changes_summary":"","estimated_score_improvement":0}

Rules:
- applied_fixes: one entry per issue you fixed. location = "intro", "section 2", "conclusion", etc.
- changes_summary: 1-2 sentence overview.
- estimated_score_improvement: number between 5 and 40.
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

Rewrite the content to fix every issue listed above. Keep facts intact. Output HTML, then delimiter, then JSON meta.`

    const raw = await callClaude(SYSTEM, prompt, 4000, 'claude-haiku-4-5-20251001')

    const DELIM = '===FIXER_META==='
    const delimIdx = raw.indexOf(DELIM)

    let fixed_content = raw.trim()
    let meta: { applied_fixes?: Array<{ issue: string; fix_applied: string; location: string }>; changes_summary?: string; estimated_score_improvement?: number } = {}

    if (delimIdx > 0) {
      fixed_content = raw.slice(0, delimIdx).trim()
      try {
        meta = extractJSON(raw.slice(delimIdx + DELIM.length).trim())
      } catch {
        // meta parsing failed, use defaults
      }
    }

    // Clean up any stray code fences Claude sometimes adds
    fixed_content = fixed_content.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

    return apiSuccess({
      fixed_content,
      applied_fixes: meta.applied_fixes ?? [],
      changes_summary: meta.changes_summary ?? 'Content rewritten to address the reported issues.',
      estimated_score_improvement: meta.estimated_score_improvement ?? 15,
      userPlan: user.plan,
      mode: mode || 'auto',
      original_content: content,
    })
  } catch (e) {
    return apiError(e)
  }
}