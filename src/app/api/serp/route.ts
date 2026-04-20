import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callClaude, extractJSON } from '@/lib/anthropic'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('serp')
    const { url, keyword, position, biztype, city } = await req.json()

    if (!url || !keyword) return apiError(new Error('URL and keyword are required'))

    const ctx = `URL:${url} | Keyword:"${keyword}" | Position:#${position || '?'} | Biz:${biztype || 'business'}${city ? ` | City:${city}` : ''}`

    const sys1 = `SEO strategist. Return ONLY valid JSON. Context: ${ctx}.
{"serp_overview":{"dominant_types":[""],"serp_features":[""],"competition_level":"medium","ymyl":false},"competitors":[{"rank":1,"url":"","authority":"high","page_type":"","word_count":"2000","local_signals":"medium","eeat":"medium","schema":["LocalBusiness"],"backlinks":"medium"}],"root_causes":[{"dimension":"","diagnosis":"","severity":"high"}],"competitor_explanations":[{"rank":1,"url":"","page_type_model":"root_domain|subdirectory|directory_listicle|local_native|national_chain","why_they_rank":"","gap_to_close":""}],"gap_scores":{"target":{"domain_authority":0,"local_signals":0,"content_depth":0,"eeat":0,"backlinks":0,"technical_health":0,"brand_authority":0},"competitor1":{"name":"","domain_authority":0,"local_signals":0,"content_depth":0,"eeat":0,"backlinks":0,"technical_health":0,"brand_authority":0},"competitor2":{"name":"","domain_authority":0,"local_signals":0,"content_depth":0,"eeat":0,"backlinks":0,"technical_health":0,"brand_authority":0},"competitor3":{"name":"","domain_authority":0,"local_signals":0,"content_depth":0,"eeat":0,"backlinks":0,"technical_health":0,"brand_authority":0}}}
Rules: exactly 5 competitors. exactly 4 root_causes. gap scores 1-10. All strings max 12 words.`

    const sys2 = `SEO recovery strategist. Return ONLY valid JSON. Context: ${ctx}.
{"action_plan":{"phase1":[{"task":"","why":"","effort":"2hrs","impact":"high","priority":"critical"}],"phase2":[{"task":"","why":"","effort":"3days","impact":"high","priority":"high"}],"phase3":[{"task":"","why":"","effort":"2wks","impact":"high","priority":"medium"}]},"rank_projection":[{"month":"Mo 1","position":0},{"month":"Mo 2","position":0},{"month":"Mo 3","position":0},{"month":"Mo 4","position":0},{"month":"Mo 5","position":0},{"month":"Mo 6","position":0}],"structural_recommendation":{"title":"","detail":"","tradeoffs":""}}
Rules: phase1=3 tasks (weeks 1-4), phase2=3 tasks (weeks 5-10), phase3=3 tasks (weeks 11-20). Realistic rank projection.`

    const [r1, r2] = await Promise.all([
      callClaude(sys1, `SERP audit for: ${url} targeting "${keyword}"`, 2500),
      callClaude(sys2, `Recovery plan for: ${url} targeting "${keyword}"`, 2000),
    ])

    const result = {
      ...extractJSON(r1),
      ...extractJSON(r2),
      _meta: { url, keyword, position, city },
      plan: user.plan,
    }

    return apiSuccess(result)
  } catch (e) {
    return apiError(e)
  }
}
