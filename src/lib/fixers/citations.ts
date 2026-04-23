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
  const citationIssues = issues.filter((i) => i.category === 'citations')

  if (citationIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  const industry = detectIndustry(content)
  const issuesList = citationIssues.map((i) => i.issue).join('\n')

  const prompt = `You are editing content for the ${industry} industry.

Content:
${content}

Citation/attribution issues to fix:
${issuesList}

Find EVERY unsourced claim, statistic, or assertion in the content that needs citation. For each one, provide:
1. The exact claim/sentence (word-for-word from content)
2. A contextual source or attribution appropriate for ${industry} (e.g., "per 2024 industry report", "according to customer survey", "based on case study")
3. How to integrate it naturally

Be thorough - identify ALL claims needing citations, not just 1-2.

Return ONLY valid JSON:
{
  "fixes": [
    {
      "claim": "the exact unsourced claim",
      "source": "contextual source or attribution",
      "attribution_format": "how to integrate (e.g., 'per [source]', '[source, year]')"
    }
  ]
}`

  const raw = await callClaude(
    `You are a comprehensive content editor. For any industry, identify ALL unsourced claims and suggest detailed contextual attributions. Return ONLY JSON.`,
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
    console.error('Citation fixes parse error:', e)
    return { fixed_content: content, applied_fixes: [] }
  }

  let fixedContent = content
  const appliedFixes: AppliedFix[] = []

  if (fixesData.fixes && Array.isArray(fixesData.fixes)) {
    for (const fix of fixesData.fixes) {
      if (fix.claim && fix.source) {
        const claimRegex = new RegExp(escapeRegex(fix.claim), 'g')
        let count = 0
        const originalLength = fixedContent.length

        fixedContent = fixedContent.replace(claimRegex, (match) => {
          count++
          if (count === 1) {
            const format = fix.attribution_format || `${match} (${fix.source})`
            return format.includes('[source]') 
              ? format.replace('[source]', fix.source)
              : `${match} (${fix.source})`
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
    if (matchCount >= 2) {
      return industry
    }
  }

  return 'general'
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}