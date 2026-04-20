import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Service — SemanticToolz' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 h-14 flex items-center gap-4">
        <Link href="/" className="font-extrabold text-slate-900">◈ SemanticToolz</Link>
        <div className="flex-1" />
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">Dashboard</Link>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-12">Last updated: January 2025</p>

        {[
          {
            title: '1. Acceptance of Terms',
            body: `By creating an account and using SemanticToolz, you agree to these Terms of Service. If you do not agree, please do not use the service.`
          },
          {
            title: '2. Description of Service',
            body: `SemanticToolz provides AI-powered content analysis and optimization tools. The service uses large language models to analyse content and generate recommendations. Results are provided for informational purposes and do not guarantee specific SEO outcomes.`
          },
          {
            title: '3. Account and Plans',
            body: `You must create an account to use SemanticToolz. Free accounts are limited to 3 analyses per month. Pro accounts are limited to 50 analyses per month. Agency accounts are limited to 200 analyses per month. Unused analyses do not roll over. We reserve the right to modify plan limits with 30 days notice.`
          },
          {
            title: '4. Payments and Refunds',
            body: `Paid plans are billed monthly or annually via Lemon Squeezy. All payments are non-refundable except where required by law. You may cancel your subscription at any time — you will retain access to paid features until the end of your current billing period.`
          },
          {
            title: '5. Acceptable Use',
            body: `You may not use SemanticToolz to generate content that is illegal, harmful, or violates third-party rights. You may not attempt to circumvent usage limits, reverse-engineer the service, or use automated scripts to abuse the API. We reserve the right to suspend accounts that violate these terms.`
          },
          {
            title: '6. Content and Intellectual Property',
            body: `You retain ownership of all content you submit for analysis. SemanticToolz does not claim any rights over your content. The SemanticToolz platform, interface, and codebase are proprietary and protected by intellectual property law.`
          },
          {
            title: '7. Limitation of Liability',
            body: `SemanticToolz is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our maximum liability is limited to the amount you paid in the 3 months preceding the claim.`
          },
          {
            title: '8. Changes to Terms',
            body: `We may update these terms at any time. We will notify you by email for material changes. Continued use of the service after changes constitutes acceptance of the new terms.`
          },
          {
            title: '9. Governing Law',
            body: `These terms are governed by the laws of the jurisdiction in which SemanticToolz is registered. Disputes will be resolved through binding arbitration where permitted by law.`
          },
          {
            title: '10. Contact',
            body: `For questions about these terms, contact legal@semantictoolz.com.`
          },
        ].map(s => (
          <section key={s.title} className="mb-10">
            <h2 className="text-lg font-bold mb-3">{s.title}</h2>
            <p className="text-slate-600 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
