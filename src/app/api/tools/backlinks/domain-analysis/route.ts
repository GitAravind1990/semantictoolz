import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { fetchBacklinkSummary, fetchBacklinks, fetchReferringDomains } from '@/lib/dataforseo'
import { apiError, apiSuccess } from '@/lib/api'
import { Plan } from '@prisma/client'
import { AuthError } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

async function getProUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new AuthError(401, 'Not authenticated')
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new AuthError(401, 'User not found')
  if (user.plan === Plan.FREE) throw new AuthError(403, 'PRO plan required')
  return user
}

function cleanDomain(input: string): string {
  return input.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase().split('/')[0]
}

export async function GET() {
  try {
    const user = await getProUser()
    const analyses = await prisma.backlinkDomainAnalysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, domain: true, backlinksTotal: true, dofollowLinks: true,
        nofollowLinks: true, referringDomains: true, referringIPs: true,
        spamScore: true, domainRank: true, newBacklinks14d: true,
        lostBacklinks14d: true, newReferringDomains14d: true,
        lostReferringDomains14d: true, brokenBacklinks: true, createdAt: true,
      },
    })
    return apiSuccess(analyses)
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getProUser()
    const { domain: rawDomain } = await req.json()
    if (!rawDomain?.trim()) throw new AuthError(400, 'Domain required')

    const domain = cleanDomain(rawDomain.trim())

    if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
      throw new AuthError(500, 'DataForSEO credentials not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to environment variables.')
    }

    // Run all 3 DataForSEO calls in parallel
    const [summary, backlinks, referringDomains] = await Promise.all([
      fetchBacklinkSummary(domain),
      fetchBacklinks(domain, 100),
      fetchReferringDomains(domain, 50),
    ])

    const analysis = await prisma.backlinkDomainAnalysis.create({
      data: {
        userId: user.id,
        domain,
        backlinksTotal:           summary.backlinks ?? 0,
        dofollowLinks:            summary.dofollow ?? 0,
        nofollowLinks:            summary.nofollow ?? 0,
        referringDomains:         summary.referring_domains ?? 0,
        referringIPs:             summary.referring_ips ?? 0,
        spamScore:                Math.round(summary.spam_score ?? 0),
        brokenBacklinks:          summary.broken_backlinks ?? 0,
        newBacklinks14d:          summary.new_backlinks_14d ?? 0,
        lostBacklinks14d:         summary.lost_backlinks_14d ?? 0,
        newReferringDomains14d:   summary.new_referring_domains_14d ?? 0,
        lostReferringDomains14d:  summary.lost_referring_domains_14d ?? 0,
        domainRank:               summary.rank_absolute ?? 0,
        topBacklinks:             JSON.stringify(backlinks),
        topReferringDomains:      JSON.stringify(referringDomains),
      },
    })

    return apiSuccess({ success: true, analysisId: analysis.id })
  } catch (e) {
    return apiError(e)
  }
}
