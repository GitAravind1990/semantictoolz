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

const SYSTEM = `You are a content preservation expert. Output the COMPLETE original content with ZERO deletions.

CRITICAL RULES:
- Output EVERY word, paragraph, heading, section from original
- NEVER condense, merge, or remove content
- Add text if needed to fix issues, but NEVER remove
- Output must be ≥100% of original word count
- Format as clean HTML (h1-h3, p, ul, li, strong, em)`

function buildAuthorBlock(profile: AuthorProfile | undefined): string {
  if (!profile || (!profile.name && !profile.reviewer_name)) {
    return 'Use generic byline.'
  }
  const lines: string[] = []
  if (profile.name) lines.push(`Author: ${profile.name}`)
  if (profile.title) lines.push(`Title: ${profile.title}`)
  if (profile.credentials) lines.push(`Credentials: ${profile.credentials}`)
  if (profile.experience) lines.push(`Experience: ${profile.experience}`)
  if (profile.reviewer_name) lines.push(`Reviewer: ${profile.reviewer_name}`)
  if (profile.reviewer_credentials) lines.push(`Reviewer Credentials: ${profile.reviewer_credentials}`)
  return lines.join(' | ')
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('fixer')
    const { content, issues, author } = await req.json()

    if (!content || content.length < 50) {
      return apiError({ message: 'Content too short', status: 400, name: 'ValidationError' })
    }
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return apiError({ message: 'Issues required', status: 400, name: 'ValidationError' })
    }

    const originalWordCount = content.trim().split(/\s+/).length
    const issuesList = issues.slice(0, 10).map((i: any, idx: number) =>
      `${idx + 1}. ${i.issue}`
    ).join('\n')

    const authorBlock = buildAuthorBlock(author as AuthorProfile | undefined)

    const prompt = `Output the COMPLETE original content below. Include EVERY paragraph and the conclusion.

Fix ONLY these issues by adding or modifying text (NEVER delete):
${issuesList}

Author info: ${authorBlock}

ORIGINAL (preserve all, output ≥${originalWordCount} words):
${content}

Output as HTML. Do not condense.`

    const raw = await callClaude(SYSTEM, prompt, 8000, 'claude-sonnet-4-6')

    let fixedContent = raw.trim()
    
    // Clean markdown fences if present
    fixedContent = fixedContent
      .replace(/^```html\n?/i, '')
      .replace(/^```\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim()

    // Count words from HTML
    const newWordCount = fixedContent
      .replace(/<[^>]+>/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w).length

    return apiSuccess({
      fixed_content: fixedContent,
      applied_fixes: [],
      changes_summary: 'Content fixed while preserving original.',
      original_word_count: originalWordCount,
      new_word_count: newWordCount,
      length_ratio: Math.round((newWordCount / originalWordCount) * 100),
      userPlan: user.plan,
    })
  } catch (e) {
    return apiError(e)
  }
}