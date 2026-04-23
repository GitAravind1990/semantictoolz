import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callClaude } from '@/lib/anthropic'
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

const SYSTEM = `Rewrite the content to fix the issues. Keep it the same length or longer. Output only HTML.`

function buildAuthorBlock(profile: AuthorProfile | undefined): string {
  if (!profile || (!profile.name && !profile.reviewer_name)) return ''
  const lines: string[] = []
  if (profile.name) lines.push(`Author: ${profile.name}`)
  if (profile.credentials) lines.push(`Credentials: ${profile.credentials}`)
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
    const issuesList = issues.slice(0, 5).map((i: any) => `- ${i.issue}`).join('\n')
    const authorInfo = buildAuthorBlock(author as AuthorProfile | undefined)

    const prompt = `Fix these issues: ${issuesList}

Author: ${authorInfo}

Content (keep all paragraphs, especially the conclusion):
${content.slice(0, 7000)}`

    const raw = await callClaude(SYSTEM, prompt, 4000, 'claude-haiku-4-5-20251001')

    let fixedContent = raw.trim()
      .replace(/^```html\n?/i, '')
      .replace(/^```\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim()

    const newWordCount = fixedContent
      .replace(/<[^>]+>/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w).length

    return apiSuccess({
      fixed_content: fixedContent,
      applied_fixes: [],
      changes_summary: 'Content fixed.',
      original_word_count: originalWordCount,
      new_word_count: newWordCount,
      length_ratio: Math.round((newWordCount / originalWordCount) * 100),
      userPlan: user.plan,
    })
  } catch (e) {
    return apiError(e)
  }
}