import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callClaude, extractJSON } from '@/lib/anthropic'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'
export const maxDuration = 60

type AuthorProfile = {
  name?: string
  title?: string
  credentials?: string
  experience?: string
  reviewer_name?: string
  reviewer_credentials?: string
}

const SYSTEM = `You are an expert SEO editor. Your job is to SURGICALLY FIX specific issues in content while preserving the original article almost entirely.

const SYSTEM = `You are an expert SEO editor. Your ONLY job is to SURGICALLY FIX specific issues while preserving 100% of the original content length and structure.

🚨 CRITICAL RULES (MANDATORY - FAILURE TO FOLLOW = FAILED TASK):
1. The output MUST be AT LEAST 100% of the original word count (do not shorten even 1 character)
2. Preserve EVERY heading, paragraph, sentence, and word from the original
3. ONLY modify the exact sentences that have reported issues
4. For each issue, make the MINIMUM surgical change needed
5. When adding content (author info, schema placeholders), INSERT it without removing anything
6. DO NOT condense, summarize, or rewrite any untouched sections
7. DO NOT merge paragraphs
8. DO NOT remove sections
9. If content must grow to fix issues, that's GOOD - let it grow

HOW TO FIX:
- For each reported issue, find the exact sentence/paragraph that causes it
- Make a minimal, surgical edit to that sentence only
- Leave everything else byte-for-byte identical
- When adding author/reviewer info, use ONLY the author profile provided (do not invent)

OUTPUT FORMAT (follow EXACTLY):
Step 1: Write the full rewritten content as HTML. Use <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. NO markdown.
Step 2: On a new line, write: ===FIXER_META===
Step 3: Write JSON: {"applied_fixes":[{"issue":"","fix_applied":"","location":""}],"changes_summary":"","estimated_score_improvement":0,"original_word_count":0,"new_word_count":0}`

function buildAuthorBlock(profile: AuthorProfile | undefined): string {
  if (!profile || (!profile.name && !profile.reviewer_name)) {
    return 'AUTHOR PROFILE: Not provided. Use a generic "Editorial Team" byline. Do NOT invent author names, credentials, or experience.'
  }
  const lines: string[] = ['AUTHOR PROFILE (use these exact details — do not change or invent):']
  if (profile.name) lines.push(`- Author name: ${profile.name}`)
  if (profile.title) lines.push(`- Author title: ${profile.title}`)
  if (profile.credentials) lines.push(`- Author credentials: ${profile.credentials}`)
  if (profile.experience) lines.push(`- Author experience: ${profile.experience}`)
  if (profile.reviewer_name) lines.push(`- Medical/Expert reviewer: ${profile.reviewer_name}`)
  if (profile.reviewer_credentials) lines.push(`- Reviewer credentials: ${profile.reviewer_credentials}`)
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('fixer')
    const { content, issues, mode, author } = await req.json()

    if (!content || content.length < 50) {
      return apiError({ message: 'Content too short (min 50 chars)', status: 400, name: 'ValidationError' })
    }
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return apiError({ message: 'At least one issue is required', status: 400, name: 'ValidationError' })
    }

    const originalWordCount = content.trim().split(/\s+/).length

    const issuesList = issues.slice(0, 10).map((i: { issue: string; fix?: string; impact?: string }, idx: number) =>
      `${idx + 1}. [${i.impact || 'medium'}] ${i.issue}${i.fix ? ` — Suggested fix: ${i.fix}` : ''}`
    ).join('\n')

    const authorBlock = buildAuthorBlock(author as AuthorProfile | undefined)

    const prompt = `Fix ONLY these issues in the content below. Mode: ${mode || 'auto'}.

${authorBlock}

ORIGINAL WORD COUNT: ${originalWordCount} words.
YOUR OUTPUT MUST BE AT LEAST ${Math.floor(originalWordCount * 0.90)} WORDS (90% of original).

ISSUES TO FIX:
${issuesList}

ORIGINAL CONTENT (preserve structure, headings, paragraphs, and facts):
${content.slice(0, 5000)}

Apply surgical fixes. Keep everything else byte-for-byte identical where possible. Output HTML, then delimiter, then JSON meta.`

    const raw = await callClaude(SYSTEM, prompt, 5000, 'claude-haiku-4-5-20251001')

    const DELIM = '===FIXER_META==='
    const delimIdx = raw.indexOf(DELIM)

    let fixed_content = raw.trim()
    let meta: { applied_fixes?: Array<{ issue: string; fix_applied: string; location: string }>; changes_summary?: string; estimated_score_improvement?: number; original_word_count?: number; new_word_count?: number } = {}

    if (delimIdx > 0) {
      fixed_content = raw.slice(0, delimIdx).trim()
      try {
        meta = extractJSON(raw.slice(delimIdx + DELIM.length).trim())
      } catch {
        // meta parsing failed, use defaults
      }
    }

    fixed_content = fixed_content.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

    const newWordCount = fixed_content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length

    return apiSuccess({
      fixed_content,
      applied_fixes: meta.applied_fixes ?? [],
      changes_summary: meta.changes_summary ?? 'Content rewritten to address the reported issues.',
      estimated_score_improvement: meta.estimated_score_improvement ?? 15,
      original_word_count: originalWordCount,
      new_word_count: newWordCount,
      length_ratio: Math.round((newWordCount / originalWordCount) * 100),
      userPlan: user.plan,
      mode: mode || 'auto',
      original_content: content,
    })
  } catch (e) {
    return apiError(e)
  }
}