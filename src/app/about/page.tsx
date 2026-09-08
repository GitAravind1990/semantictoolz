import Link from 'next/link'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { PLAN_LIMITS } from '@/lib/plans'

export const metadata: Metadata = {
  title: 'About – Optmizly',
  description:
    'Optmizly is built by one person. Why it exists, what it does, and an honest account of how early it is.',
}

/**
 * Exists because "who built this?" is the first question on a founder-led channel, and the
 * answer was a 404.
 *
 * Deliberately says how small and how new this is. A one-person product that admits it reads
 * as more trustworthy than one implying a team it does not have — and the alternative, filling
 * the page with stock photography and invented milestones, is the thing the homepage already
 * promises not to do.
 */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <PageHeader />

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-black mb-3">About Optmizly</h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-12">
          One place to answer a question that used to need six tools: why aren&apos;t we showing up?
        </p>

        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">Why it exists</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Optimizing a site meant a keyword tool, a crawler, a rank tracker, a schema validator
            and two spreadsheets to reconcile them — and none of them could tell me whether an AI
            assistant could read the page at all. That question was not in any of their answers,
            and it is the one that increasingly decides who gets found.
          </p>
          <p className="text-slate-600 leading-relaxed">
            So I built the thing I wanted: one place where discovery, auditing, optimizing and
            monitoring share the same data, and where the AI-search side is treated as real work
            rather than a buzzword bolted onto a keyword tool.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">What it actually does</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Three kinds of optimization in one loop. <strong>SEO</strong> for how you rank in
            traditional search. <strong>GEO</strong> for whether generative engines like ChatGPT,
            Gemini, Claude and Perplexity cite you. <strong>AEO</strong> for whether your pages
            answer the questions people actually ask.
          </p>
          <p className="text-slate-600 leading-relaxed">
            The same content is scored across all three, so a fix for one is not a regression in
            another — which is the failure mode of running separate tools that never talk.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">The honest part</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Optmizly is new, and I am one person. There is no case-study wall on this site because
            there are no case studies yet, and I would rather say that than fill the space with
            stock photos and invented numbers. No logo bar of companies that have not heard of me,
            no testimonials I wrote myself, no user count dressed up to look larger.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            What I can offer instead is the product. A free tier that does not expire and needs no
            card, at {PLAN_LIMITS.FREE} analyses a month. Four tools that need no account at all.
            And an audit that shows you everything it finds rather than holding half of it back to
            make you sign up.
          </p>
          <p className="text-slate-600 leading-relaxed">
            If something is wrong or missing, tell me. At this size I read everything, and I can
            usually fix it the same week.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">Who builds it</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
              A
            </div>
            <div>
              <div className="font-bold text-slate-900">Aravindraj</div>
              <div className="text-sm text-slate-500">Founder — design, code, support and the replies</div>
            </div>
          </div>
          <p className="text-slate-600 leading-relaxed">
            There is no team behind this. When you email support, I am the one who answers.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">Try it before you trust it</h2>
          <p className="text-slate-600 leading-relaxed mb-5">
            You do not need an account to find out whether any of this is useful. Run the free AI
            search readiness audit on your own site and judge the output.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/tools/ai-search-readiness"
              className="inline-block rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
            >
              Run the free audit →
            </Link>
            <Link
              href="/pricing"
              className="inline-block rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300"
            >
              See pricing
            </Link>
          </div>
        </section>

        <div className="flex gap-6 border-t border-slate-200 pt-8 text-sm text-slate-400">
          <Link href="/contact" className="hover:text-slate-700">Contact</Link>
          <Link href="/privacy" className="hover:text-slate-700">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-slate-700">Terms of Service</Link>
        </div>
      </div>
    </div>
  )
}
