import { callClaude } from '@/lib/anthropic'

export interface FixerIssue {
  issue: string
  category: string
  fix: string
  impact: string
}

export interface AppliedFix {
  issue: string
  claim: string
  source: string
  location: string
}

export async function fixCitationIssues(
  content: string,
  issues: FixerIssue[]
): Promise<{ fixed_content: string; applied_fixes: AppliedFix[] }> {
  // Filter only citation-related issues
  const citationIssues = issues.filter((i) => i.category === 'citations')

  if (citationIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  // Detect industry context
  const industry = detectIndustry(content)

  const issuesList = citationIssues.map((i) => i.issue).join('\n')

  const prompt = `You are editing content for the ${industry} industry.

Content:
${content}

Citation/attribution issues to fix:
${issuesList}

For EACH unsourced claim, provide:
1. The exact claim/sentence that needs a citation
2. A contextual source or attribution appropriate for ${industry}
3. How to integrate it naturally (e.g., "per [source]", "[source, year]", etc.)

Return ONLY valid JSON:
{
  "fixes": [
    {
      "claim": "the unsourced claim/sentence",
      "source": "appropriate source or attribution",
      "attribution_format": "how to integrate (e.g., 'per [source]')"
    }
  ]
}`

  const raw = await callClaude(
    `You are a universal content editor. For any industry, identify unsourced claims and suggest contextual attributions. Return ONLY JSON.`,
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
    console.error('Citation fixes parse error:', e)
    return { fixed_content: content, applied_fixes: [] }
  }

  // Apply fixes surgically
  let fixedContent = content
  const appliedFixes: AppliedFix[] = []

  if (fixesData.fixes && Array.isArray(fixesData.fixes)) {
    for (const fix of fixesData.fixes) {
      if (fix.claim && fix.source) {
        // Find the claim in content and append attribution
        const claimRegex = new RegExp(escapeRegex(fix.claim), 'g')
        let count = 0
        const originalLength = fixedContent.length

        fixedContent = fixedContent.replace(claimRegex, (match) => {
          count++
          if (count === 1) {
            // Append source attribution naturally
            const format = fix.attribution_format || `${match} (${fix.source})`
            return `${match} ${fix.attribution_format ? fix.attribution_format.replace('[source]', fix.source) : `(${fix.source})`}`
          }
          return match
        })

        if (fixedContent.length > originalLength) {
          appliedFixes.push({
            issue: `Citation added: ${fix.source}`,
            claim: fix.claim.substring(0, 80),
            source: fix.source,
            location: 'In content'
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