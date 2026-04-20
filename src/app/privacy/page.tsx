import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy — SemanticToolz' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 h-14 flex items-center gap-4">
        <Link href="/" className="font-extrabold text-slate-900">◈ SemanticToolz</Link>
        <div className="flex-1" />
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">Dashboard</Link>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-12">Last updated: January 2025</p>

        {[
          {
            title: '1. Information We Collect',
            body: `We collect information you provide when creating an account — your email address and name via our authentication provider (Clerk). We also collect usage data such as the number of analyses you run per month to enforce plan limits. We do not store the content you analyse — it is sent to the Anthropic API to generate results and is not retained on our servers.`
          },
          {
            title: '2. How We Use Your Information',
            body: `We use your email address to send transactional emails (account confirmation, subscription receipts, cancellation confirmations). We use usage data solely to enforce monthly plan limits. We do not sell, rent, or share your personal data with third parties for marketing purposes.`
          },
          {
            title: '3. Third-Party Services',
            body: `SemanticToolz uses the following third-party services: Clerk (authentication and user management), Supabase (database), Lemon Squeezy (payment processing), Anthropic (AI analysis), Resend (transactional email), and Vercel (hosting). Each service has its own privacy policy. Content you submit for analysis is processed by Anthropic's API — please review Anthropic's privacy policy at anthropic.com.`
          },
          {
            title: '4. Data Retention',
            body: `We retain your account data (email, plan, usage count) for as long as your account is active. If you delete your account, your data is removed within 30 days. Monthly usage counts are reset each calendar month.`
          },
          {
            title: '5. Cookies',
            body: `We use session cookies for authentication (managed by Clerk). We do not use tracking or advertising cookies.`
          },
          {
            title: '6. Your Rights',
            body: `You may request access to, correction of, or deletion of your personal data at any time by contacting us at privacy@semantictoolz.com. EU/UK users have additional rights under GDPR including the right to data portability and the right to object to processing.`
          },
          {
            title: '7. Security',
            body: `We use industry-standard security practices. Passwords are managed by Clerk and never stored by SemanticToolz directly. All data is transmitted over HTTPS. Payment information is handled entirely by Lemon Squeezy and is never stored on our servers.`
          },
          {
            title: '8. Contact',
            body: `For privacy-related questions, contact us at privacy@semantictoolz.com.`
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
