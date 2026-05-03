import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callClaude, extractJSON } from '@/lib/anthropic'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM = `You are a professional SEO keyword research specialist. Analyse the seed keyword and return ONLY valid JSON:
{
  "summary": "2-sentence strategic overview of this keyword's opportunity",
  "primary_keywords": [
    {
      "keyword": "exact keyword phrase",
      "intent": "informational|commercial|transactional|navigational",
      "volume": "high|medium|low",
      "difficulty": "easy|medium|hard",
      "opportunity": "high|medium|low",
      "notes": "why this keyword matters"
    }
  ],
  "longtail": [
    {
      "keyword": "long-tail phrase (4+ words)",
      "intent": "informational|commercial|transactional|navigational",
      "difficulty": "easy|medium|hard",
      "angle": "content angle to target this keyword"
    }
  ],
  "questions": [
    "question keyword one?",
    "question keyword two?"
  ],
  "clusters": [
    {
      "theme": "cluster theme name",
      "description": "what this cluster covers",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "content_gaps": [
    "specific subtopic or angle competitors likely cover that you should too"
  ]
}
Rules:
- primary_keywords: exactly 8, mix of head terms and mid-tail
- longtail: exactly 10 keywords, all 4+ words, low/medium difficulty
- questions: exactly 8 questions (People Also Ask style)
- clusters: exactly 4 thematic clusters, 4-6 keywords each
- content_gaps: exactly 5 specific gaps
- All strings concise and actionable`

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('keyword-research')
    const { keyword, context } = await req.json()
    if (!keyword || keyword.trim().length < 2) {
      return apiError(new Error('Please enter a seed keyword'))
    }

    const prompt = `Seed keyword: "${keyword.trim()}"${context ? `\nAdditional context: ${context.slice(0, 500)}` : ''}\n\nGenerate comprehensive keyword research.`
    const raw = await callClaude(SYSTEM, prompt, 3000)
    return apiSuccess({ ...extractJSON(raw), seed: keyword.trim(), userPlan: user.plan })
  } catch (e) {
    return apiError(e)
  }
}
