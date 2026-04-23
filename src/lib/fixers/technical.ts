import { callClaude } from '@/lib/anthropic'

export interface FixerIssue {
  issue: string
  category: string
  fix: string
  impact: string
}

export interface AppliedFix {
  issue: string
  recommendation: string
  implementation: string
}

export async function fixTechnicalIssues(
  content: string,
  issues: FixerIssue[]
): Promise<{ fixed_content: string; applied_fixes: AppliedFix[] }> {
  // Filter only technical SEO issues
  const technicalIssues = issues.filter((i) => i.category === 'technical')

  if (technicalIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  // Detect industry context
  const industry = detectIndustry(content)

  // Extract title from content (first H1 or first line)
  const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i) || content.match(/^#+\s(.+)/m)
  const contentTitle = titleMatch ? titleMatch[1] : 'Content Title'

  const issuesList = technicalIssues.map((i) => i.issue).join('\n')

  const prompt = `You are a technical SEO expert for the ${industry} industry.

Content Title: ${contentTitle}
Content:
${content.substring(0, 1000)}...

Technical SEO issues:
${issuesList}

For each technical SEO issue, provide:
1. Specific recommendation (meta tag, schema markup, structure improvement)
2. Implementation (exact code or instruction)
3. Why it helps SEO for ${industry}

Return ONLY valid JSON:
{
  "fixes": [
    {
      "issue": "the technical issue",
      "recommendation": "what to implement",
      "implementation": "exact code or instruction",
      "seo_benefit": "why this helps"
    }
  ]
}`

  const raw = await callClaude(
    `You are a universal technical SEO expert. For any industry, provide specific technical SEO recommendations with implementation details. Return ONLY JSON.`,
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
    console.error('Technical fixes parse error:', e)
    return { fixed_content: content, applied_fixes: [] }
  }

  // For technical SEO, we add suggestions as comments/notes rather than modifying content
  // This preserves the original content while providing actionable recommendations
  let fixedContent = content
  const appliedFixes: AppliedFix[] = []

  if (fixesData.fixes && Array.isArray(fixesData.fixes)) {
    // Prepend technical SEO recommendations as a comment section
    let technicalNotes = '<!-- TECHNICAL SEO RECOMMENDATIONS -->\n'

    for (const fix of fixesData.fixes) {
      if (fix.recommendation && fix.implementation) {
        technicalNotes += `<!-- ${fix.issue}: ${fix.recommendation} -->\n`
        appliedFixes.push({
          issue: `Technical SEO: ${fix.issue}`,
          recommendation: fix.recommendation,
          implementation: fix.implementation.substring(0, 150)
        })
      }
    }

    technicalNotes += '<!-- END TECHNICAL SEO RECOMMENDATIONS -->\n\n'

    // Add recommendations at the top as HTML comments (won't display but visible in source)
    fixedContent = technicalNotes + content
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