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

    const cwvResponse = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${GOOGLE_API_KEY}&category=performance`
    );
    const cwvData = await cwvResponse.json();

    if (!cwvData.lighthouseResult) {
      return NextResponse.json({ error: 'Failed to analyze URL. Check the URL is publicly accessible.' }, { status: 500 });
    }

    const audits = cwvData.lighthouseResult.audits;
    const metrics = {
      lcp: (audits['largest-contentful-paint']?.numericValue ?? 0) / 1000,
      cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
      fid: audits['first-input-delay']?.numericValue ?? null,
      inp: audits['interaction-to-next-paint']?.numericValue ?? null,
      lcpScore: Math.round((audits['largest-contentful-paint']?.score ?? 0) * 100),
      clsScore: Math.round((audits['cumulative-layout-shift']?.score ?? 0) * 100),
      fidScore: audits['first-input-delay']?.score != null
        ? Math.round(audits['first-input-delay'].score * 100)
        : null,
      overallScore: Math.round(cwvData.lighthouseResult.categories.performance.score * 100),
    };

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

async function generateAIFixes(url: string, metrics: Record<string, number | null>): Promise<AIFix[]> {
  const prompt = `You are a web performance expert. Generate 5 SPECIFIC, copy-paste ready code fixes for this website.

URL: ${url}
- LCP: ${metrics.lcp}s (Score: ${metrics.lcpScore}/100)
- CLS: ${metrics.cls} (Score: ${metrics.clsScore}/100)
- FID: ${metrics.fid != null ? metrics.fid + 'ms' : 'N/A'}
- Overall Performance Score: ${metrics.overallScore}/100

Generate exactly 5 targeted code fixes. Return ONLY a valid JSON array, no extra text:
[
  {
    "type": "image|css|js|html",
    "issue": "Specific problem description",
    "beforeCode": "exact original code snippet",
    "afterCode": "exact optimized code snippet",
    "description": "Why this fix improves performance",
    "estimatedImpact": 15,
    "language": "html|css|javascript"
  }
]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
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

function calculateProjectedScore(metrics: Record<string, number | null>, fixes: AIFix[]): number {
  const current = metrics.overallScore as number;
  const gain = fixes.reduce((sum, f) => sum + f.estimatedImpact, 0);
  return Math.min(100, Math.max(0, current + gain));
}

function calculateROI(metrics: Record<string, number | null>, projectedScore: number) {
  const improvement = projectedScore - (metrics.overallScore as number);
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
