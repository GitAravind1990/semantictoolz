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

CRITICAL PRESERVATION RULES (failing these = failed task):
1. The output MUST be at least 95% of the original word count. Do NOT shorten, summarize, or condense.
2. Preserve every heading (H1, H2, H3) from the original unless an issue explicitly requires changing one.
3. Preserve every paragraph. Only modify paragraphs affected by a reported issue. Leave untouched paragraphs exactly as written.
4. Preserve every statistic, number, date, proper noun, named entity, and factual claim.
5. Keep the original section order and structure.
6. Do NOT remove entire sections. Do NOT merge paragraphs. Do NOT rewrite unaffected areas.

HOW TO FIX:
- For each reported issue, make the MINIMUM change needed to resolve it.
- Add new content (bylines, schema placeholders, internal link placeholders, disclaimers) where required, but do not replace existing content.
- When adding author/reviewer info, use ONLY the author profile provided by the user. If a field is missing, OMIT it (do not invent credentials, names, or experience).

OUTPUT FORMAT:
Step 1: Write the full content as HTML. Use <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>. No markdown. No code fences.
Step 2: On a new line, write exactly: ===FIXER_META===
Step 3: Write this JSON:
{"applied_fixes":[{"issue":"","fix_applied":"","location":""}],"changes_summary":"","estimated_score_improvement":0,"original_word_count":0,"new_word_count":0}`

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

    const raw = await callClaude(SYSTEM, prompt, 4000, 'claude-haiku-4-5-20251001')

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