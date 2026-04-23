import { callClaude } from '@/lib/anthropic'

export interface FixerIssue {
  issue: string
  category: string
  fix: string
  impact: string
}

export interface AuthorProfile {
  name?: string
  title?: string
  credentials?: string
  experience?: string
  reviewer_name?: string
  reviewer_credentials?: string
}

export interface AppliedFix {
  issue: string
  author_section: string
  credentials: string
}

export async function fixEEATIssues(
  content: string,
  issues: FixerIssue[],
  author?: AuthorProfile
): Promise<{ fixed_content: string; applied_fixes: AppliedFix[] }> {
  const eeatIssues = issues.filter((i) => i.category === 'eeat')

  if (eeatIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  const industry = detectIndustry(content)
  const issuesList = eeatIssues.map((i) => i.issue).join('\n')
  const authorInfo = author
    ? `Provided author: ${author.name || 'Unknown'}, ${author.credentials || 'Credentials not provided'}, ${author.experience || 'Experience not provided'}`
    : 'No author information provided'

  const prompt = `You are editing content for the ${industry} industry.

Content:
${content}

E-E-A-T issues:
${issuesList}

Author information:
${authorInfo}

Create a COMPREHENSIVE author/expert credentials section that:
1. Establishes expertise across MULTIPLE dimensions (certifications, experience, achievements, specializations)
2. Includes specific credentials, years of experience, awards/recognition
3. For ${industry}: include industry-specific qualifications
4. Can be 3-5 sentences (detailed, not minimal)
5. If no author provided, create a generic expert bio template
6. Include multiple expertise areas if possible

Return ONLY valid JSON:
{
  "author_section": "The detailed HTML/text for the author section",
  "placement": "top|after_intro|before_conclusion",
  "explanation": "why this placement helps E-E-A-T",
  "expertise_areas": ["area1", "area2", "area3"]
}`

  const raw = await callClaude(
    `You are a comprehensive E-E-A-T editor. For any industry, create detailed author/expert credibility sections with multiple expertise dimensions. Return ONLY JSON.`,
    prompt,
    2000,
    'claude-haiku-4-5-20251001'
  )

  let fixesData: any = { author_section: '', placement: 'top', expertise_areas: [] }
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      fixesData = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('E-E-A-T fixes parse error:', e)
    return { fixed_content: content, applied_fixes: [] }
  }

  let fixedContent = content
  const appliedFixes: AppliedFix[] = []

  if (fixesData.author_section) {
    const placement = fixesData.placement || 'top'

    if (placement === 'top') {
      fixedContent = `${fixesData.author_section}\n\n${content}`
    } else if (placement === 'after_intro') {
      const firstBreak = content.indexOf('\n\n')
      if (firstBreak > 0) {
        fixedContent =
          content.substring(0, firstBreak + 2) + fixesData.author_section + '\n\n' + content.substring(firstBreak + 2)
      } else {
        fixedContent = `${fixesData.author_section}\n\n${content}`
      }
    } else if (placement === 'before_conclusion') {
      const lastBreak = content.lastIndexOf('\n\n')
      if (lastBreak > 0 && lastBreak > content.length / 2) {
        fixedContent =
          content.substring(0, lastBreak) +
          '\n\n' +
          fixesData.author_section +
          '\n\n' +
          content.substring(lastBreak + 2)
      } else {
        fixedContent = `${content}\n\n${fixesData.author_section}`
      }
    }

    appliedFixes.push({
      issue: 'E-E-A-T: Comprehensive author credentials and expertise added',
      author_section: fixesData.author_section.substring(0, 150),
      credentials: fixesData.expertise_areas?.join(', ') || 'Established expertise'
    })
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