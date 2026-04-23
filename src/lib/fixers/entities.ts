import { callClaude } from '@/lib/anthropic'

export interface FixerIssue {
  issue: string
  category: string
  fix: string
  impact: string
}

export interface AppliedFix {
  issue: string
  entity: string
  definition: string
  location: string
}

export async function fixEntityIssues(
  content: string,
  issues: FixerIssue[]
): Promise<{ fixed_content: string; applied_fixes: AppliedFix[] }> {
  const entityIssues = issues.filter((i) => i.category === 'entities')

  if (entityIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  const industry = detectIndustry(content)
  const issuesList = entityIssues.map((i) => i.issue).join('\n')

  const prompt = `You are editing content for the ${industry} industry.

Content:
${content}

Entity issues to fix:
${issuesList}

For EVERY undefined entity/term mentioned in the issues, provide:
1. The exact entity name
2. A detailed, contextual definition (2-3 sentences) appropriate for ${industry}
3. The first sentence where it appears

Be thorough - identify ALL undefined entities, not just a few.

Return ONLY valid JSON:
{
  "fixes": [
    {
      "entity": "term name",
      "definition": "detailed 2-3 sentence definition",
      "location": "first sentence"
    }
  ]
}`

  const raw = await callClaude(
    `You are a comprehensive content editor. For any industry, identify ALL undefined entities and provide detailed contextual definitions. Return ONLY JSON.`,
    prompt,
    3000,
    'claude-haiku-4-5-20251001'
  )

  let fixesData: any = { fixes: [] }
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      fixesData = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Entity fixes parse error:', e)
    return { fixed_content: content, applied_fixes: [] }
  }

  let fixedContent = content
  const appliedFixes: AppliedFix[] = []

  if (fixesData.fixes && Array.isArray(fixesData.fixes)) {
    for (const fix of fixesData.fixes) {
      if (fix.entity && fix.definition) {
        const regex = new RegExp(`\\b${fix.entity}\\b`, 'g')
        let count = 0
        const originalLength = fixedContent.length

        fixedContent = fixedContent.replace(regex, (match) => {
          count++
          if (count === 1) {
            return `<strong>${match}</strong> (${fix.definition})`
          }
          return match
        })

        if (fixedContent.length > originalLength) {
          appliedFixes.push({
            issue: `Entity definition: ${fix.entity}`,
            entity: fix.entity,
            definition: fix.definition,
            location: fix.location || 'First mention'
          })
        }
      }
    }
  }

  return { fixed_content: fixedContent, applied_fixes: appliedFixes }
}

function detectIndustry(content: string): string {
  const keywords: Record<string, string[]> = {
    'software/SaaS': ['API', 'platform', 'cloud', 'database', 'integration', 'dashboard', 'deployment', 'saas'],
    'restaurant/hospitality': ['menu', 'chef', 'cuisine', 'dish', 'ingredients', 'reservation', 'dining', 'restaurant'],
    'healthcare/medical': ['patient', 'treatment', 'diagnosis', 'surgery', 'doctor', 'hospital', 'symptom', 'medical'],
    'real estate': ['property', 'listing', 'mortgage', 'bedroom', 'price', 'agent', 'inspection', 'real estate'],
    'fashion/e-commerce': ['product', 'design', 'style', 'collection', 'material', 'color', 'size', 'shop'],
    'fitness/coaching': ['workout', 'training', 'coach', 'exercise', 'client', 'goal', 'progress', 'fitness'],
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