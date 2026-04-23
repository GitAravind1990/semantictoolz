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
  // Filter only E-E-A-T related issues
  const eeatIssues = issues.filter((i) => i.category === 'eeat')

  if (eeatIssues.length === 0) {
    return { fixed_content: content, applied_fixes: [] }
  }

  // Detect industry context
  const industry = detectIndustry(content)

  const issuesList = eeatIssues.map((i) => i.issue).join('\n')
  const authorInfo = author
    ? `Provided author: ${author.name || 'Unknown'}, ${author.credentials || 'Credentials not provided'}, ${author.experience || 'Experience not provided'}`
    : 'No author information provided'

  const prompt = `You are editing content for the ${industry} industry.

Content:
${content}

E-E-A-T issues (Expertise, Authoritativeness, Trustworthiness):
${issuesList}

Author information:
${authorInfo}

Create a professional author/expert credentials section that:
1. Fits naturally into ${industry} content
2. Establishes credibility and expertise
3. Is 2-3 sentences maximum
4. Uses the provided author info if available, or suggest generic format if not

Return ONLY valid JSON:
{
  "author_section": "The HTML/text for the author section (can include <strong>, <em>, etc.)",
  "placement": "where in article to place it (top, after_intro, or before_conclusion)",
  "explanation": "why this placement helps E-E-A-T"
}`

  const raw = await callClaude(
    `You are a universal content editor. For any industry, create author/expert credibility sections. Return ONLY JSON.`,
    prompt,
    1500,
    'claude-haiku-4-5-20251001'
  )

  let fixesData: any = { author_section: '', placement: 'top' }
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
    // Insert author section based on placement
    const placement = fixesData.placement || 'top'

    if (placement === 'top') {
      // Insert at very beginning
      fixedContent = `${fixesData.author_section}\n\n${content}`
    } else if (placement === 'after_intro') {
      // Find first paragraph break and insert after it
      const firstBreak = content.indexOf('\n\n')
      if (firstBreak > 0) {
        fixedContent =
          content.substring(0, firstBreak + 2) + fixesData.author_section + '\n\n' + content.substring(firstBreak + 2)
      } else {
        fixedContent = `${fixesData.author_section}\n\n${content}`
      }
    } else if (placement === 'before_conclusion') {
      // Insert near end (before last paragraph)
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
      issue: 'E-E-A-T: Author credentials and expertise added',
      author_section: fixesData.author_section.substring(0, 100),
      credentials: author?.credentials || 'Established through expert positioning'
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
    if (matchCount >= 3) {
      return industry
    }
  }

  return 'general'
}