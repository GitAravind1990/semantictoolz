'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui'

const PLANS = [
  {
    name: 'Free', price: { monthly: '$0', annual: '$0' }, period: 'forever',
    color: 'gray', productId: null,
    features: ['3 analyses / month', '8-dimension content score', 'Issues audit', 'Entity detection', 'AI Cite Score'],
    cta: 'Get Started Free', href: '/signup',
  },
  {
    name: 'Pro', price: { monthly: '$19', annual: '$15.83' }, period: '/month',
    color: 'blue', featured: true,
    productId: { monthly: process.env.NEXT_PUBLIC_CREEM_PRODUCT_PRO_MONTHLY, annual: process.env.NEXT_PUBLIC_CREEM_PRODUCT_PRO_ANNUAL },
    features: ['50 analyses / month', 'Everything in Free', 'E-E-A-T deep analysis', 'Relevant Backlinks finder', 'AI content rewriter', 'Citation strategy engine', 'Content Gap analyzer', 'AI Query mapper'],
    cta: 'Start Pro',
  },
  {
    name: 'Agency', price: { monthly: '$49', annual: '$40.83' }, period: '/month',
    color: 'amber',
    productId: { monthly: process.env.NEXT_PUBLIC_CREEM_PRODUCT_AGENCY_MONTHLY, annual: process.env.NEXT_PUBLIC_CREEM_PRODUCT_AGENCY_ANNUAL },
    features: ['200 analyses / month', 'Everything in Pro', 'AI Citation Tracker', 'Local SEO Suite (4 tools)', 'SERP Competitor Audit', 'Topical Authority Mapper ★'],
    cta: 'Start Agency',
  },
]

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(plan: typeof PLANS[0]) {
    if (!plan.productId || plan.href) {
      if (plan.href) window.location.href = plan.href
      return
    }
    const productId = plan.productId[billing]
    if (!productId) return
    setLoading(plan.name)
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      window.location.href = d.url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-2 mb-8 font-extrabold text-slate-900">
            <span className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white text-sm">◈</span>
            SemanticToolz
          </Link>
          <h1 className="text-4xl font-black tracking-tight mb-4">Simple, transparent pricing</h1>
          <p className="text-slate-500 mb-8">Start free. Upgrade when you need more.</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(['monthly', 'annual'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${billing === b ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {b === 'monthly' ? 'Monthly' : 'Annual (save 20%)'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map(plan => (
            <div key={plan.name} className={`relative rounded-2xl p-7 ${plan.featured ? 'bg-white border-2 border-brand-600 shadow-xl shadow-blue-100' : 'bg-white border border-slate-200'}`}>
              {plan.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-bold text-white whitespace-nowrap">
                  Most Popular
                </div>
              )}
              <div className="text-sm font-bold text-slate-500 mb-2">{plan.name}</div>
              <div className={`text-4xl font-black mb-1 ${plan.color === 'blue' ? 'text-brand-600' : plan.color === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>
                {plan.price[billing]}
              </div>
              <div className="text-sm text-slate-400 mb-6">{plan.period}{billing === 'annual' && plan.name !== 'Free' ? ' · billed annually' : ''}</div>
              <div className="h-px bg-slate-100 mb-6" />
              {plan.features.map(f => (
                <div key={f} className="flex items-start gap-2 text-sm mb-2.5">
                  <span className="text-emerald-500 font-bold mt-0.5 flex-shrink-0">✓</span>
                  <span>{f}</span>
                </div>
              ))}
              <button
                onClick={() => handleCheckout(plan)}
                disabled={loading === plan.name}
                className={`mt-6 w-full rounded-xl py-3 text-sm font-extrabold transition-opacity hover:opacity-90 disabled:opacity-50 ${
                  plan.color === 'blue' ? 'bg-brand-600 text-white' :
                  plan.color === 'amber' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white' :
                  'bg-slate-100 text-slate-700'
                }`}
              >
                {loading === plan.name ? 'Redirecting…' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-10">
          Payments processed by Creem
        </p>
      </div>
    </div>
  )
}
