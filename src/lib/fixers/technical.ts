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
  const technicalIssues = issues.filter((i) => i.category === 'technical')

  if (technicalIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  const industry = detectIndustry(content)
  const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i) || content.match(/^#+\s(.+)/m)
  const contentTitle = titleMatch ? titleMatch[1] : 'Content Title'

  const issuesList = technicalIssues.map((i) => i.issue).join('\n')

  const prompt = `You are a technical SEO expert for the ${industry} industry.

Content Title: ${contentTitle}
Content Preview:
${content.substring(0, 1500)}...

Technical SEO issues to fix:
${issuesList}

For EVERY technical SEO issue, provide:
1. Specific recommendation (what to implement)
2. Detailed implementation (exact code snippet or precise instruction)
3. Why it helps ${industry} SEO
4. Priority level (high/medium/low)

Be thorough - provide detailed, actionable recommendations for ALL issues, not just 1-2.

Return ONLY valid JSON:
{
  "fixes": [
    {
      "issue": "the technical issue",
      "recommendation": "what to implement",
      "implementation": "exact code, tag, or detailed instruction",
      "seo_benefit": "why this helps SEO",
      "priority": "high|medium|low"
    }
  ]
}`

  const raw = await callClaude(
    `You are a comprehensive technical SEO expert. For any industry, provide detailed, actionable technical SEO recommendations with exact implementations. Return ONLY JSON.`,
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
    console.error('Technical fixes parse error:', e)
    return { fixed_content: content, applied_fixes: [] }
  }

  let fixedContent = content
  const appliedFixes: AppliedFix[] = []

  if (fixesData.fixes && Array.isArray(fixesData.fixes)) {
    // Build comprehensive technical recommendations section
    let technicalNotes = '\n\n<!-- TECHNICAL SEO RECOMMENDATIONS -->\n'

    for (const fix of fixesData.fixes) {
      if (fix.recommendation && fix.implementation) {
        technicalNotes += `<!-- [${fix.priority?.toUpperCase() || 'MEDIUM'}] ${fix.issue}: ${fix.recommendation} -->\n`
        technicalNotes += `<!-- Implementation: ${fix.implementation.substring(0, 200)} -->\n\n`
        
        appliedFixes.push({
          issue: `[${fix.priority?.toUpperCase() || 'MEDIUM'}] ${fix.issue}`,
          recommendation: fix.recommendation,
          implementation: fix.implementation.substring(0, 150)
        })
      }
    }

    technicalNotes += '<!-- END TECHNICAL SEO RECOMMENDATIONS -->\n'
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
    if (matchCount >= 2) {
      return industry
    }
  }

  return 'general'
}