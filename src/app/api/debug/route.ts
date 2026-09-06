import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { dodoMode } from '@/lib/dodopayments'

export const runtime = 'nodejs'

function check(key: string) {
  const val = process.env[key]
  return val ? `SET (${val.length} chars)` : 'MISSING'
}

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status })

  return Response.json({
    DATABASE_URL:                     check('DATABASE_URL'),
    CLERK_SECRET_KEY:                 check('CLERK_SECRET_KEY'),
    CLERK_WEBHOOK_SECRET:             check('CLERK_WEBHOOK_SECRET'),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: check('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
    ANTHROPIC_API_KEY:                check('ANTHROPIC_API_KEY'),
    // Both modes are reported unconditionally, and DODO_MODE says which pair is actually in
    // use. Showing only the live pair would report a correctly configured test deployment as
    // fully configured while the credentials it really reads are missing.
    DODO_MODE:                        dodoMode(),
    DODO_API_KEY:                     check('DODO_API_KEY'),
    DODO_WEBHOOK_SECRET:              check('DODO_WEBHOOK_SECRET'),
    DODO_TEST_API_KEY:                check('DODO_TEST_API_KEY'),
    DODO_TEST_WEBHOOK_SECRET:         check('DODO_TEST_WEBHOOK_SECRET'),
    RESEND_API_KEY:                   check('RESEND_API_KEY'),
    NEXT_PUBLIC_APP_URL:              check('NEXT_PUBLIC_APP_URL'),
    VERCEL_ENV:                       process.env['VERCEL_ENV'] ?? '(not set)',
    NODE_ENV:                         process.env['NODE_ENV'],
  })
}
