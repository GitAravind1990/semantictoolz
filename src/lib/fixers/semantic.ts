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
  // Filter only semantic richness issues
  const semanticIssues = issues.filter((i) => i.category === 'semantic')

  if (semanticIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  // Detect industry context
  const industry = detectIndustry(content)

  const issuesList = semanticIssues.map((i) => i.issue).join('\n')

  const prompt = `You are editing content for the ${industry} industry.

Content:
${content}

Semantic richness issues (vague, shallow, or unexplained concepts):
${issuesList}

For EACH vague claim, provide:
1. The exact vague sentence/phrase from the content
2. An expanded version with:
   - Specific details or context
   - Examples or use cases
   - Metrics or measurements if relevant
   - Benefits or implications
3. Keep expansion to 1-2 additional sentences max

Return ONLY valid JSON:
{
  "fixes": [
    {
      "vague_text": "the original vague phrase",
      "expanded_text": "the enriched version with details and context"
    }
  ]
}`

  const raw = await callClaude(
    `You are a universal content editor. For any industry, expand vague claims with specific details, context, and examples. Return ONLY JSON.`,
    prompt,
    2000,
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

  // Apply fixes surgically
  let fixedContent = content
  const appliedFixes: AppliedFix[] = []

  if (fixesData.fixes && Array.isArray(fixesData.fixes)) {
    for (const fix of fixesData.fixes) {
      if (fix.vague_text && fix.expanded_text) {
        // Find and replace vague text with expanded version
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
            issue: 'Semantic Richness: Vague claim expanded with details',
            original_text: fix.vague_text.substring(0, 80),
            expanded_text: fix.expanded_text.substring(0, 100)
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
    if (matchCount >= 3) {
      return industry
    }
  }

  return 'general'
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}