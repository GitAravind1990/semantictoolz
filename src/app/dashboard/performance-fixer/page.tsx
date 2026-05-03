'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Metrics {
  lcp: number;
  cls: number;
  fid: number | null;
  lcpScore: number;
  clsScore: number;
  fidScore: number | null;
  overallScore: number;
}

interface Fix {
  type: string;
  issue: string;
  beforeCode: string;
  afterCode: string;
  description: string;
  estimatedImpact: number;
  language: string;
}

interface ROI {
  currentRevenueLoss: number;
  potentialRevenue: number;
  fixTime: number;
  estimatedCost: number;
}

interface IndustryData {
  avg: number;
  topPercent: number;
  rank: number;
}

interface AuditResult {
  url: string;
  metrics: Metrics;
  projectedScore: number;
  fixes: Fix[];
  roi: ROI;
  industryData: IndustryData | null;
  auditId: string;
}

export default function PerformanceFixerPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [userPlan, setUserPlan] = useState<string>('FREE');
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then(data => {
        setUserPlan(data.plan ?? 'FREE');
        setCheckingPlan(false);
      })
      .catch(() => setCheckingPlan(false));
  }, []);

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/tools/performance-fixer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, industry }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data);
      } else {
        alert(data.message ?? data.error ?? 'Analysis failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingPlan) {
    return <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>;
  }

  if (userPlan !== 'AGENCY') {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-amber-50 to-purple-50 border border-amber-200 p-12 rounded-2xl text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-black mb-2">Agency-Exclusive Tool</h1>
            <p className="text-slate-600 mb-6">
              AI Performance Fixer is available exclusively on the Agency plan ($49/mo).
            </p>
            <div className="bg-white rounded-xl p-6 mb-6 text-left border border-amber-100">
              <h2 className="font-bold text-sm mb-3 text-slate-700">What you unlock:</h2>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> AI-Generated Code Fixes (Claude AI)</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> ROI Calculator — revenue impact analysis</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Industry Benchmarks — compare vs peers</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> 50 audits / month</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Copy-paste ready code fixes</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/pricing')}
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                Upgrade to Agency — $49/mo
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="border border-slate-200 hover:bg-slate-50 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            ⚡ AI Performance Fixer
            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded font-bold">AGENCY</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Analyze Core Web Vitals, get AI-generated code fixes, and see ROI projections.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Website URL</label>
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Industry <span className="font-normal text-slate-400">(optional — enables benchmarks)</span></label>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Select industry…</option>
              <option value="ecommerce">E-commerce</option>
              <option value="saas">SaaS</option>
              <option value="blog">Blog / Content</option>
              <option value="portfolio">Portfolio</option>
              <option value="news">News / Media</option>
            </select>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !url}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
          >
            {loading ? '🔍 Analyzing & generating AI fixes…' : '⚡ Analyze + Get AI Code Fixes'}
          </button>
        </div>

        {result && <ResultsDisplay result={result} />}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? 'text-green-600' :
    score >= 50 ? 'text-yellow-500' :
    'text-red-500';
  return <span className={`text-5xl font-black ${color}`}>{score}</span>;
}

function ResultsDisplay({ result }: { result: AuditResult }) {
  const gain = result.projectedScore - result.metrics.overallScore;

  return (
    <div className="space-y-6">
      {/* Score overview */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-600 mb-4">Performance Score</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <ScoreBadge score={result.metrics.overallScore} />
            <div className="text-xs text-slate-500 mt-1">Current</div>
          </div>
          <div>
            <span className="text-5xl font-black text-green-600">{result.projectedScore}</span>
            <div className="text-xs text-slate-500 mt-1">After Fixes</div>
          </div>
          <div>
            <span className="text-5xl font-black text-blue-600">+{gain}</span>
            <div className="text-xs text-slate-500 mt-1">Improvement</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          <div>LCP: <span className="font-bold text-slate-700">{result.metrics.lcp.toFixed(2)}s</span></div>
          <div>CLS: <span className="font-bold text-slate-700">{result.metrics.cls.toFixed(3)}</span></div>
          <div>FID: <span className="font-bold text-slate-700">{result.metrics.fid != null ? result.metrics.fid + 'ms' : 'N/A'}</span></div>
        </div>
      </div>

      {/* ROI */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-100 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">💰 ROI Calculator</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-black text-red-500">${result.roi.currentRevenueLoss}</div>
            <div className="text-xs text-slate-500 mt-1">Monthly Revenue Loss</div>
          </div>
          <div>
            <div className="text-2xl font-black text-green-600">${result.roi.potentialRevenue}</div>
            <div className="text-xs text-slate-500 mt-1">Potential Monthly Revenue</div>
          </div>
          <div>
            <div className="text-2xl font-black text-blue-600">{result.roi.fixTime}min</div>
            <div className="text-xs text-slate-500 mt-1">Est. Time to Fix</div>
          </div>
        </div>
      </div>

      {/* AI Fixes */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">🤖 AI-Generated Code Fixes ({result.fixes.length})</h2>
        <div className="space-y-4">
          {result.fixes.map((fix, idx) => (
            <FixCard key={idx} fix={fix} index={idx + 1} />
          ))}
        </div>
      </div>

      {/* Industry Benchmark */}
      {result.industryData && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">📊 Industry Benchmark</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-black text-slate-700">{result.metrics.overallScore}</div>
              <div className="text-xs text-slate-500 mt-1">Your Score</div>
            </div>
            <div>
              <div className="text-3xl font-black text-blue-600">{result.industryData.avg}</div>
              <div className="text-xs text-slate-500 mt-1">Industry Average</div>
            </div>
            <div>
              <div className="text-3xl font-black text-green-600">{result.industryData.topPercent}</div>
              <div className="text-xs text-slate-500 mt-1">Top 10%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FixCard({ fix, index }: { fix: Fix; index: number }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(fix.afterCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-slate-100 rounded-lg p-4">
      <div className="flex items-start justify-between mb-1.5">
        <h3 className="text-sm font-semibold text-slate-800">Fix {index}: {fix.issue}</h3>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold ml-3 flex-shrink-0">
          +{fix.estimatedImpact} pts
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{fix.description}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-bold text-red-500 mb-1">❌ Before</div>
          <pre className="text-[11px] bg-slate-50 border border-slate-100 p-3 rounded overflow-x-auto text-slate-700">{fix.beforeCode}</pre>
        </div>
        <div>
          <div className="text-[10px] font-bold text-green-600 mb-1">✅ After</div>
          <pre className="text-[11px] bg-slate-50 border border-slate-100 p-3 rounded overflow-x-auto text-slate-700">{fix.afterCode}</pre>
        </div>
      </div>
      <button
        onClick={copy}
        className="mt-3 text-xs border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
      >
        {copied ? '✅ Copied!' : '📋 Copy Fix'}
      </button>
    </div>
  );
}
