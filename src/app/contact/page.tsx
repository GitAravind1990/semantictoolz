import Link from 'next/link'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'

export const metadata: Metadata = {
  title: 'Contact – Optmizly',
  description: 'How to reach Optmizly: support, billing, privacy and security. One person answers all of it.',
}

/**
 * Addresses, not a form.
 *
 * A contact form on a one-person product is worse for both sides: the sender gets no record of
 * what they sent and no address to follow up, and it implies a ticketing system that does not
 * exist. These four addresses are the ones already published in the Terms, Refund Policy and
 * Privacy Policy — listed together here so nobody has to read a legal page to find them.
 */
const ROUTES = [
  {
    label: 'Support and anything about the product',
    email: 'support@Optmizly.com',
    note: 'Bugs, questions, something that looks wrong in a result. Include the URL you analysed and I can usually reproduce it.',
  },
  {
    label: 'Billing, refunds and cancellations',
    email: 'support@Optmizly.com',
    note: 'You can also cancel yourself at any time from Settings → Billing, without emailing anyone.',
  },
  {
    label: 'Privacy and data requests',
    email: 'privacy@Optmizly.com',
    note: 'Access, export or deletion of your data.',
  },
  {
    label: 'Legal',
    email: 'legal@Optmizly.com',
    note: 'Questions about the Terms of Service.',
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <PageHeader />

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-black mb-3">Contact</h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-4">
          Optmizly is built and supported by one person, so there is no queue and no first-line
          script. Email goes straight to me.
        </p>
        <p className="text-slate-600 leading-relaxed mb-12">
          I aim to reply within <strong className="text-slate-900">one business day</strong>. If
          something is broken and costing you money, say so in the subject line and I will look at
          it first.
        </p>

        <div className="mb-12 flex flex-col gap-1 overflow-hidden rounded-2xl border border-slate-200">
          {ROUTES.map((r, i) => (
            <div
              key={r.label + i}
              className={`bg-white p-5 ${i > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {r.label}
              </div>
              <a
                href={`mailto:${r.email}`}
                className="text-base font-bold text-brand-600 hover:text-brand-700"
              >
                {r.email}
              </a>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{r.note}</p>
            </div>
          ))}
        </div>

        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">Before you email about a result</h2>
          <p className="text-slate-600 leading-relaxed">
            Most questions are about why a score looks the way it does. Every audit lists what it
            could and could not check — that section is worth reading first, because the honest
            answer is often that the page blocks the crawler rather than that the score is wrong.
            If it still looks wrong, send me the URL. I would rather know.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">Found a security issue?</h2>
          <p className="text-slate-600 leading-relaxed">
            Email <a href="mailto:support@Optmizly.com" className="font-bold text-brand-600 hover:text-brand-700">support@Optmizly.com</a> with
            &ldquo;security&rdquo; in the subject and I will treat it as the priority. Please give
            me a chance to fix it before publishing it anywhere.
          </p>
        </section>

        <div className="flex gap-6 border-t border-slate-200 pt-8 text-sm text-slate-400">
          <Link href="/about" className="hover:text-slate-700">About</Link>
          <Link href="/privacy" className="hover:text-slate-700">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-slate-700">Terms of Service</Link>
          <Link href="/refund-policy" className="hover:text-slate-700">Refund Policy</Link>
        </div>
      </div>
    </div>
  )
}
