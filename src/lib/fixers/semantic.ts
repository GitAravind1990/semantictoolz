import { callClaude } from '@/lib/anthropic'

export interface FixerIssue {
  issue: string
  category: string
  fix: string
  impact: string
}

export interface AppliedFix {
  issue: string
  original_text: string
  expanded_text: string
}

export async function fixSemanticIssues(
  content: string,
  issues: FixerIssue[]
): Promise<{ fixed_content: string; applied_fixes: AppliedFix[] }> {
  const semanticIssues = issues.filter((i) => i.category === 'semantic')

  if (semanticIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  const industry = detectIndustry(content)
  const issuesList = semanticIssues.map((i) => i.issue).join('\n')

  const prompt = `You are editing content for the ${industry} industry.

Content:
${content}

Semantic richness issues (vague, shallow, or unexplained concepts):
${issuesList}

For EVERY vague or shallow claim in the content, provide:
1. The exact vague phrase (word-for-word from content)
2. A comprehensive expansion (3-4 sentences) with:
   - Specific details, metrics, or measurements
   - Concrete examples or use cases
   - Context and implications
   - Industry-specific terminology
3. Make expansions DETAILED and SUBSTANTIVE, not minimal

Be thorough - identify ALL vague claims, not just 1-2.

Return ONLY valid JSON:
{
  "fixes": [
    {
      "vague_text": "the original vague phrase",
      "expanded_text": "detailed 3-4 sentence expansion with specifics, examples, metrics"
    }
  ]
}`

  const raw = await callClaude(
    `You are a comprehensive content editor. For any industry, expand EVERY vague claim with detailed specifics, metrics, examples, and context. Return ONLY JSON.`,
    prompt,
    3500,
    'claude-haiku-4-5-20251001'
  )

  let fixesData: any = { fixes: [] }
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      fixesData = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Semantic fixes parse error:', e)
    return { fixed_content: content, applied_fixes: [] }
  }

  let fixedContent = content
  const appliedFixes: AppliedFix[] = []

  if (fixesData.fixes && Array.isArray(fixesData.fixes)) {
    for (const fix of fixesData.fixes) {
      if (fix.vague_text && fix.expanded_text) {
        const regex = new RegExp(escapeRegex(fix.vague_text), 'g')
        let count = 0
        const originalLength = fixedContent.length

        fixedContent = fixedContent.replace(regex, (match) => {
          count++
          if (count === 1) {
            return fix.expanded_text
          }
          return match
        })

        if (fixedContent.length > originalLength) {
          appliedFixes.push({
            issue: 'Semantic Richness: Vague claim expanded with detailed context',
            original_text: fix.vague_text.substring(0, 80),
            expanded_text: fix.expanded_text.substring(0, 120)
          })
        }
      }
    }
  }

  return { fixed_content: fixedContent, applied_fixes: appliedFixes }
}

function detectIndustry(content: string): string {
  const keywords: Record<string, string[]> = {
    'software/SaaS': ['API', 'platform', 'cloud', 'database', 'integration', 'dashboard', 'deployment'],
    'restaurant/hospitality': ['menu', 'chef', 'cuisine', 'dish', 'ingredients', 'reservation', 'dining'],
    'healthcare/medical': ['patient', 'treatment', 'diagnosis', 'surgery', 'doctor', 'hospital', 'symptom'],
    'real estate': ['property', 'listing', 'mortgage', 'bedroom', 'price', 'agent', 'inspection'],
    'fashion/e-commerce': ['product', 'design', 'style', 'collection', 'material', 'color', 'size'],
    'fitness/coaching': ['workout', 'training', 'coach', 'exercise', 'client', 'goal', 'progress'],
  }

  const contentLower = content.toLowerCase()

  for (const [industry, words] of Object.entries(keywords)) {
    const matchCount = words.filter((w) => contentLower.includes(w.toLowerCase())).length
    if (matchCount >= 2) {
      return industry
    }
  }

  return 'business'
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}