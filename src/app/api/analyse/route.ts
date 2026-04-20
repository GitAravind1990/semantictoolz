import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callClaude, extractJSON } from '@/lib/anthropic'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'

const SYSTEM = `You are an expert SEO and content analyst. Analyse the provided content and return ONLY valid JSON:
{"overall_score":0,"grade":"D","summary":"","scores":{"technical_seo":0,"on_page_seo":0,"entity_optimization":0,"eeat_signals":0,"semantic_richness":0,"llm_citation_triggers":0,"structured_data":0,"authority_reinforcement":0},"top_issues":[{"issue":"","category":"","impact":"high|medium|low","fix":""}],"entity_gaps":[""],"quick_wins":[""],"llm_citation_tip":""}
Rules: overall_score 0-100. grade S(90+) A(80+) B(70+) C(55+) D(<55). top_issues: 5-7 ranked by impact. entity_gaps: 6-8 missing entities. quick_wins: 4-5 specific actions.`

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('analyse')
    const { content } = await req.json()

    if (!content || content.length < 50) {
      return apiError({ message: 'Content too short', status: 400, name: 'ValidationError' })
    }

    const raw = await callClaude(SYSTEM, `Analyse this content:\n\n${content.slice(0, 5000)}`, 2000)
    const result = extractJSON(raw)

    return apiSuccess({ ...result, userPlan: user.plan })
  } catch (e) {
    return apiError(e)
  }
}
