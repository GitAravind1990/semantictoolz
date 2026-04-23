import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api'
import { fixEntityIssues } from '@/lib/fixers/entities'
import { fixCitationIssues } from '@/lib/fixers/citations'
import { fixEEATIssues } from '@/lib/fixers/eeat'
import { fixSemanticIssues } from '@/lib/fixers/semantic'
import { fixTechnicalIssues } from '@/lib/fixers/technical'

export const runtime = 'nodejs'
export const maxDuration = 60

interface AuthorProfile {
  name?: string
  title?: string
  credentials?: string
  experience?: string
  reviewer_name?: string
  reviewer_credentials?: string
}

interface OptimizerIssue {
  issue: string
  category: string
  type: string
  impact: string
  fix: string
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('optimizer')
    const { content, issues, author, selectedFixTypes } = await req.json()

    if (!content || content.length < 50) {
      return apiError({ message: 'Content too short (min 50 chars)', status: 400, name: 'ValidationError' })
    }
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return apiError({ message: 'Issues required', status: 400, name: 'ValidationError' })
    }

    const originalWordCount = content.trim().split(/\s+/).length
    let optimizedContent = content
    const allAppliedFixes: any[] = []

    // Determine which fixers to apply (default: all if not specified)
    const fixTypes = selectedFixTypes || ['entities', 'citations', 'eeat', 'semantic', 'technical']

    // Step 1: Entity Issues
    if (fixTypes.includes('entities')) {
      try {
        const entityResult = await fixEntityIssues(optimizedContent, issues as OptimizerIssue[])
        optimizedContent = entityResult.fixed_content
        allAppliedFixes.push(...entityResult.applied_fixes)
      } catch (e) {
        console.error('Entity fixer error:', e)
      }
    }

    // Step 2: Citation Issues
    if (fixTypes.includes('citations')) {
      try {
        const citationResult = await fixCitationIssues(optimizedContent, issues as OptimizerIssue[])
        optimizedContent = citationResult.fixed_content
        allAppliedFixes.push(...citationResult.applied_fixes)
      } catch (e) {
        console.error('Citation fixer error:', e)
      }
    }

    // Step 3: E-E-A-T Issues
    if (fixTypes.includes('eeat')) {
      try {
        const eeatResult = await fixEEATIssues(optimizedContent, issues as OptimizerIssue[], author as AuthorProfile | undefined)
        optimizedContent = eeatResult.fixed_content
        allAppliedFixes.push(...eeatResult.applied_fixes)
      } catch (e) {
        console.error('E-E-A-T fixer error:', e)
      }
    }

    // Step 4: Semantic Issues
    if (fixTypes.includes('semantic')) {
      try {
        const semanticResult = await fixSemanticIssues(optimizedContent, issues as OptimizerIssue[])
        optimizedContent = semanticResult.fixed_content
        allAppliedFixes.push(...semanticResult.applied_fixes)
      } catch (e) {
        console.error('Semantic fixer error:', e)
      }
    }

    // Step 5: Technical Issues
    if (fixTypes.includes('technical')) {
      try {
        const technicalResult = await fixTechnicalIssues(optimizedContent, issues as OptimizerIssue[])
        optimizedContent = technicalResult.fixed_content
        allAppliedFixes.push(...technicalResult.applied_fixes)
      } catch (e) {
        console.error('Technical fixer error:', e)
      }
    }

    // Calculate final metrics
    const newWordCount = optimizedContent.trim().split(/\s+/).length
    const lengthRatio = Math.round((newWordCount / originalWordCount) * 100)
    const meetsRequirement = lengthRatio >= 95

    const statusMessage =
      lengthRatio < 95
        ? `⚠️ Content is ${lengthRatio}% of original (needs ≥95%). Some fixes may have condensed content.`
        : lengthRatio > 100
          ? `✅ Content grew to ${lengthRatio}% - excellent! All fixes preserved and expanded content.`
          : `✅ Content at ${lengthRatio}% - good preservation with all fixes applied.`

    return apiSuccess({
      optimized_content: optimizedContent,
      applied_fixes: allAppliedFixes,
      changes_summary: `Applied ${allAppliedFixes.length} optimization fixes across ${fixTypes.length} categories.`,
      original_word_count: originalWordCount,
      new_word_count: newWordCount,
      length_ratio: lengthRatio,
      meets_requirement: meetsRequirement,
      status_message: statusMessage,
      fix_types_applied: fixTypes,
      userPlan: user.plan,
    })
  } catch (e) {
    return apiError(e)
  }
}