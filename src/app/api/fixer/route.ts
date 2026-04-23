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

const SYSTEM = `You are an expert SEO editor. Your ONLY job is to SURGICALLY FIX specific issues while preserving the ENTIRE original content.

🚨 CRITICAL RULES (NON-NEGOTIABLE):
1. Output MUST be ≥100% of original word count (NEVER condense)
2. Keep EVERY heading, paragraph, sentence, word from original
3. ONLY modify sentences with reported issues
4. Make MINIMUM surgical edits to problematic sentences
5. DO NOT merge paragraphs, remove sections, or summarize
6. When adding author info, INSERT without removing anything
7. If content grows, that's GOOD - growth is acceptable

OUTPUT EXACTLY AS:
[FULL HTML CONTENT HERE - use h1-h3, p, ul/li, strong, em]
===FIXER_META===
{"applied_fixes":[{"issue":"issue name","fix_applied":"what changed","location":"where"}],"changes_summary":"summary of all changes","original_word_count":NUMERIC,"new_word_count":NUMERIC}`

function buildAuthorBlock(profile: AuthorProfile | undefined): string {
  if (!profile || (!profile.name && !profile.reviewer_name)) {
    return 'AUTHOR INFO: Not provided. Use generic "Editorial Team" byline. DO NOT invent details.'
  }
  const lines: string[] = ['AUTHOR PROFILE (use these exact details — do not change):']
  if (profile.name) lines.push(`- Author: ${profile.name}`)
  if (profile.title) lines.push(`- Title: ${profile.title}`)
  if (profile.credentials) lines.push(`- Credentials: ${profile.credentials}`)
  if (profile.experience) lines.push(`- Experience: ${profile.experience}`)
  if (profile.reviewer_name) lines.push(`- Expert reviewer: ${profile.reviewer_name}`)
  if (profile.reviewer_credentials) lines.push(`- Reviewer credentials: ${profile.reviewer_credentials}`)
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('fixer')
    const { content, issues, author } = await req.json()

    if (!content || content.length < 50) {
      return apiError({ message: 'Content too short (min 50 chars)', status: 400, name: 'ValidationError' })
    }
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return apiError({ message: 'At least one issue required', status: 400, name: 'ValidationError' })
    }

    const originalWordCount = content.trim().split(/\s+/).length
    const issuesList = issues.slice(0, 10).map((i: any, idx: number) =>
      `${idx + 1}. [${i.impact || 'medium'}] ${i.issue}${i.fix ? ` — Fix: ${i.fix}` : ''}`
    ).join('\n')

    const authorBlock = buildAuthorBlock(author as AuthorProfile | undefined)

    const prompt = `Fix ONLY these specific issues. Preserve ALL original content including conclusion.

${authorBlock}

ORIGINAL: ${originalWordCount} words
MINIMUM OUTPUT: ${Math.floor(originalWordCount * 0.95)} words (95% - do NOT shorten)

ISSUES TO FIX:
${issuesList}

CONTENT TO FIX (include ENTIRE content, especially conclusion):
${content}

After fixing, output your result as:
[HTML content here]
===FIXER_META===
[JSON metadata]`

    const raw = await callClaude(SYSTEM, prompt, 5000, 'claude-haiku-4-5-20251001')

    const DELIM = '===FIXER_META==='
    const delimIdx = raw.indexOf(DELIM)

    if (delimIdx === -1) {
      return apiError({ message: 'Invalid response format', status: 500, name: 'ParseError' })
    }

    let fixedContent = raw.substring(0, delimIdx).trim()
    const metaRaw = raw.substring(delimIdx + DELIM.length).trim()

    // Clean up HTML formatting
    fixedContent = fixedContent.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '').trim()

    let metadata: any = {}
    try {
      // Extract JSON from potential markdown fences
      const jsonMatch = metaRaw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.error('Metadata parse error:', e)
    }

    // Count words from HTML (strip tags)
    const newWordCount = fixedContent.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(w => w).length

    return apiSuccess({
      fixed_content: fixedContent,
      applied_fixes: metadata.applied_fixes ?? [],
      changes_summary: metadata.changes_summary ?? 'Content fixed.',
      original_word_count: originalWordCount,
      new_word_count: newWordCount,
      length_ratio: Math.round((newWordCount / originalWordCount) * 100),
      userPlan: user.plan,
    })
  } catch (e) {
    return apiError(e)
  }
}