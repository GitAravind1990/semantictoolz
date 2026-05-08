import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

interface AIFix {
  type: string;
  issue: string;
  beforeCode: string;
  afterCode: string;
  description: string;
  estimatedImpact: number;
  language: string;
}

interface ExtendedMetrics {
  // Core Web Vitals
  lcp: number;
  lcpScore: number;
  cls: number;
  clsScore: number;
  fid: number | null;
  fidScore: number | null;
  inp: number | null;
  inpScore: number | null;
  // Additional metrics
  fcp: number | null;
  fcpScore: number | null;
  speedIndex: number | null;
  speedIndexScore: number | null;
  tti: number | null;
  ttiScore: number | null;
  tbt: number | null;
  tbtScore: number | null;
  ttfb: number | null;
  ttfbScore: number | null;
  overallScore: number;
  // Opportunities / diagnostics
  redirects: number | null;
  redirectsScore: number | null;
  unusedJs: number | null;
  unusedJsScore: number | null;
  unusedCss: number | null;
  unusedCssScore: number | null;
  renderBlocking: number | null;
  renderBlockingScore: number | null;
  legacyJs: number | null;
  legacyJsScore: number | null;
  totalByteWeight: number | null;
  jsBootupTime: number | null;
  jsBootupScore: number | null;
  domSize: number | null;
  mainthreadWork: number | null;
  networkRtt: number | null;
}

function extractMetrics(audits: Record<string, { score?: number | null; numericValue?: number | null }>): ExtendedMetrics {
  const n = (key: string) => audits[key]?.numericValue ?? null;
  const s = (key: string) => audits[key]?.score != null ? Math.round(audits[key].score! * 100) : null;

  return {
    lcp: (n('largest-contentful-paint') ?? 0) / 1000,
    lcpScore: s('largest-contentful-paint') ?? 0,
    cls: n('cumulative-layout-shift') ?? 0,
    clsScore: s('cumulative-layout-shift') ?? 0,
    fid: n('first-input-delay'),
    fidScore: s('first-input-delay'),
    inp: n('interaction-to-next-paint'),
    inpScore: s('interaction-to-next-paint'),
    fcp: n('first-contentful-paint') != null ? (n('first-contentful-paint')! / 1000) : null,
    fcpScore: s('first-contentful-paint'),
    speedIndex: n('speed-index') != null ? (n('speed-index')! / 1000) : null,
    speedIndexScore: s('speed-index'),
    tti: n('interactive') != null ? (n('interactive')! / 1000) : null,
    ttiScore: s('interactive'),
    tbt: n('total-blocking-time'),
    tbtScore: s('total-blocking-time'),
    ttfb: n('server-response-time'),
    ttfbScore: s('server-response-time'),
    overallScore: 0, // filled below
    redirects: n('redirects'),
    redirectsScore: s('redirects'),
    unusedJs: n('unused-javascript'),
    unusedJsScore: s('unused-javascript'),
    unusedCss: n('unused-css-rules'),
    unusedCssScore: s('unused-css-rules'),
    renderBlocking: null,
    renderBlockingScore: s('render-blocking-insight'),
    legacyJs: null,
    legacyJsScore: s('legacy-javascript-insight'),
    totalByteWeight: n('total-byte-weight'),
    jsBootupTime: n('bootup-time'),
    jsBootupScore: s('bootup-time'),
    domSize: n('dom-size-insight'),
    mainthreadWork: n('mainthread-work-breakdown'),
    networkRtt: n('network-rtt'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { url, industry } = await req.json();
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });

    if (user?.plan !== 'AGENCY') {
      return NextResponse.json({
        error: 'This tool is exclusive to Agency plan',
        requiredPlan: 'AGENCY',
        upgradeUrl: '/pricing',
        message: 'Upgrade to Agency for AI Code Fixes + ROI + Industry Benchmarks',
      }, { status: 403 });
    }

    const auditCount = await prisma.performanceFixerAudit.count({
      where: {
        userId: user.id,
        analyzedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    if (auditCount >= 50) {
      return NextResponse.json({ error: 'Quota exceeded. 50 audits/month for Agency.' }, { status: 429 });
    }

    const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    psiUrl.searchParams.set('url', url);
    psiUrl.searchParams.set('category', 'performance');
    if (GOOGLE_API_KEY) psiUrl.searchParams.set('key', GOOGLE_API_KEY);

    const cwvResponse = await fetch(psiUrl.toString());
    const cwvData = await cwvResponse.json();

    if (!cwvData.lighthouseResult) {
      const apiError = cwvData.error?.message ?? JSON.stringify(cwvData).slice(0, 200);
      console.error('PageSpeed API error:', apiError);
      return NextResponse.json({ error: `Failed to analyze URL. ${apiError}` }, { status: 500 });
    }

    const audits = cwvData.lighthouseResult.audits;
    const metrics = extractMetrics(audits);
    metrics.overallScore = Math.round(cwvData.lighthouseResult.categories.performance.score * 100);

    const fixes = await generateAIFixes(url, metrics);
    const projectedScore = calculateProjectedScore(metrics, fixes);
    const roi = calculateROI(metrics, projectedScore);
    const industryData = industry ? getIndustryComparison(industry) : null;

    const audit = await prisma.performanceFixerAudit.create({
      data: {
        userId: user.id,
        url,
        industry: industry || null,
        lcp: metrics.lcp,
        cls: metrics.cls,
        fid: metrics.fid,
        inp: metrics.inp,
        lcpScore: metrics.lcpScore,
        clsScore: metrics.clsScore,
        fidScore: metrics.fidScore,
        overallScore: metrics.overallScore,
        projectedScore,
        revenueLoss: roi.currentRevenueLoss,
        potentialRevenue: roi.potentialRevenue,
        fixTime: roi.fixTime,
        fixCost: roi.estimatedCost,
        totalFixes: fixes.length,
        industryAvg: industryData?.avg ?? null,
        industryRank: industryData?.rank ?? null,
        fixes: JSON.stringify(fixes),
        extendedMetrics: JSON.stringify(metrics),
      },
    });

    await prisma.aIFixGeneration.createMany({
      data: fixes.map(fix => ({
        auditId: audit.id,
        fixType: fix.type,
        language: fix.language,
        beforeCode: fix.beforeCode,
        afterCode: fix.afterCode,
        description: fix.description,
        estimatedImpact: fix.estimatedImpact,
      })),
    });

    return NextResponse.json({ url, metrics, projectedScore, fixes, roi, industryData, auditId: audit.id });
  } catch (error) {
    console.error('Performance Fixer error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

async function generateAIFixes(url: string, m: ExtendedMetrics): Promise<AIFix[]> {
  const fmt = (v: number | null, unit = '') => v != null ? `${v}${unit}` : 'N/A';
  const score = (v: number | null) => v != null ? `${v}/100` : 'N/A';

  const prompt = `You are a web performance expert. Analyze ALL of the following PageSpeed Insights metrics for ${url} and generate 8 SPECIFIC, copy-paste ready code fixes prioritized by impact.

CORE WEB VITALS:
- LCP: ${fmt(m.lcp, 's')} (${score(m.lcpScore)})
- CLS: ${m.cls} (${score(m.clsScore)})
- FID: ${fmt(m.fid, 'ms')} (${score(m.fidScore)})
- INP: ${fmt(m.inp, 'ms')} (${score(m.inpScore)})

ADDITIONAL METRICS:
- FCP: ${fmt(m.fcp, 's')} (${score(m.fcpScore)})
- Speed Index: ${fmt(m.speedIndex, 's')} (${score(m.speedIndexScore)})
- TTI: ${fmt(m.tti, 's')} (${score(m.ttiScore)})
- TBT: ${fmt(m.tbt, 'ms')} (${score(m.tbtScore)})
- TTFB: ${fmt(m.ttfb, 'ms')} (${score(m.ttfbScore)})
- Overall Score: ${m.overallScore}/100

OPPORTUNITIES / DIAGNOSTICS:
- Redirects: ${fmt(m.redirects, 'ms')} (score: ${score(m.redirectsScore)})
- Unused JavaScript: ${fmt(m.unusedJs, ' bytes')} (score: ${score(m.unusedJsScore)})
- Unused CSS: ${fmt(m.unusedCss, ' bytes')} (score: ${score(m.unusedCssScore)})
- Render-blocking resources: score ${score(m.renderBlockingScore)}
- Legacy JavaScript: score ${score(m.legacyJsScore)}
- Total page weight: ${m.totalByteWeight != null ? Math.round(m.totalByteWeight / 1024) + ' KB' : 'N/A'}
- JS bootup time: ${fmt(m.jsBootupTime, 'ms')} (${score(m.jsBootupScore)})
- Main thread work: ${fmt(m.mainthreadWork, 'ms')}
- DOM size: ${fmt(m.domSize, ' nodes')}
- Network RTT: ${fmt(m.networkRtt, 'ms')}

Focus fixes on the worst-scoring metrics first. Return ONLY a valid JSON array, no extra text:
[
  {
    "type": "image|css|js|html|server|network",
    "issue": "Specific problem description referencing the actual metric",
    "beforeCode": "exact original code snippet",
    "afterCode": "exact optimized code snippet",
    "description": "Why this fix improves performance and which metric it targets",
    "estimatedImpact": 15,
    "language": "html|css|javascript|http"
  }
]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (error) {
    console.error('AI generation error:', error);
    return [];
  }
}

function calculateProjectedScore(metrics: ExtendedMetrics, fixes: AIFix[]): number {
  const current = metrics.overallScore;
  const gain = fixes.reduce((sum, f) => sum + f.estimatedImpact, 0);
  return Math.min(100, Math.max(0, current + Math.round(gain / fixes.length)));
}

function calculateROI(metrics: ExtendedMetrics, projectedScore: number) {
  const improvement = projectedScore - metrics.overallScore;
  const conversionRate = 0.025;
  const traffic = 5000;
  const aov = 30;
  const multiplier = 1 + improvement * 0.005;
  const currentRevenue = traffic * conversionRate * aov;
  const potentialRevenue = currentRevenue * multiplier;
  return {
    currentRevenueLoss: Math.round((potentialRevenue - currentRevenue) * 0.5),
    potentialRevenue: Math.round(potentialRevenue),
    fixTime: Math.ceil(improvement * 5),
    estimatedCost: 0,
  };
}

function getIndustryComparison(industry: string) {
  const benchmarks: Record<string, { avg: number; topPercent: number }> = {
    ecommerce:  { avg: 65, topPercent: 92 },
    saas:       { avg: 78, topPercent: 95 },
    blog:       { avg: 70, topPercent: 90 },
    portfolio:  { avg: 80, topPercent: 95 },
    news:       { avg: 60, topPercent: 88 },
  };
  const benchmark = benchmarks[industry.toLowerCase()] ?? { avg: 70, topPercent: 90 };
  return {
    avg: benchmark.avg,
    topPercent: benchmark.topPercent,
    rank: Math.floor(Math.random() * 50) + 1,
  };
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (user?.plan !== 'AGENCY') return NextResponse.json({ error: 'Agency only' }, { status: 403 });

    const audits = await prisma.performanceFixerAudit.findMany({
      where: { userId: user.id },
      orderBy: { analyzedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ audits });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
