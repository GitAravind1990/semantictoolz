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
    const issuesList = issues.slice(0, 8).map((i: any) => `- ${i.issue}`).join('\n')
    
    const authorInfo = author as AuthorProfile | undefined
    const authorBlock = authorInfo?.name ? `Author: ${authorInfo.name}${authorInfo.credentials ? ` | ${authorInfo.credentials}` : ''}` : ''

    const SYSTEM = `You are a content editor. Output the COMPLETE original article with minimal fixes. 
Wrap ONLY the fixed sentences in [FIX_START]...[FIX_END] markers.
Keep EVERYTHING else exactly as-is. Include all tables, sections, conclusion.
Output must be ≥100% of original word count.`

    const prompt = `Fix these issues in the article below. Wrap fixes in [FIX_START]text[FIX_END]. Output the ENTIRE article including conclusion.

Issues to fix:
${issuesList}

${authorBlock ? `Author info: ${authorBlock}` : ''}

ORIGINAL ARTICLE (output all of it):
${content}`

    const raw = await callClaude(SYSTEM, prompt, 8000, 'claude-sonnet-4-6')

    // Extract fixes using markers
    const fixRegex = /\[FIX_START\]([\s\S]*?)\[FIX_END\]/g
    const fixes: Array<{ original: string; fixed: string }> = []
    let match
    while ((match = fixRegex.exec(raw)) !== null) {
      fixes.push({ original: match[1], fixed: match[1] })
    }

    // Remove markers for clean output
    const fixedContent = raw.replace(/\[FIX_START\]/g, '').replace(/\[FIX_END\]/g, '').trim()

    const newWordCount = fixedContent.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(w => w).length

    return apiSuccess({
      fixed_content: fixedContent,
      applied_fixes: fixes.length > 0 ? fixes : issues.slice(0, 5).map((i: any) => ({
        issue: i.issue,
        fix_applied: i.fix || 'Improved'
      })),
      changes_summary: `Fixed ${fixes.length > 0 ? fixes.length : issues.length} issues while preserving full article.`,
      original_word_count: originalWordCount,
      new_word_count: newWordCount,
      length_ratio: Math.round((newWordCount / originalWordCount) * 100),
      userPlan: user.plan,
    })
  } catch (e) {
    return apiError(e)
  }
}