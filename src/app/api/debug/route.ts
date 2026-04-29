import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

function check(key: string) {
  const val = process.env[key]
  return val ? `SET (${val.length} chars)` : 'MISSING'
}

export async function GET(_req: NextRequest) {
  return Response.json({
    _info: 'Runtime env var diagnostic — values are never exposed, only presence',
    DATABASE_URL:                    check('DATABASE_URL'),
    CLERK_SECRET_KEY:                check('CLERK_SECRET_KEY'),
    CLERK_WEBHOOK_SECRET:            check('CLERK_WEBHOOK_SECRET'),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: check('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
    ANTHROPIC_API_KEY:               check('ANTHROPIC_API_KEY'),
    LEMONSQUEEZY_API_KEY:            check('LEMONSQUEEZY_API_KEY'),
    LEMONSQUEEZY_STORE_ID:           check('LEMONSQUEEZY_STORE_ID'),
    LEMONSQUEEZY_WEBHOOK_SECRET:     check('LEMONSQUEEZY_WEBHOOK_SECRET'),
    LS_VARIANT_PRO_MONTHLY:          check('LS_VARIANT_PRO_MONTHLY'),
    LS_VARIANT_PRO_ANNUAL:           check('LS_VARIANT_PRO_ANNUAL'),
    LS_VARIANT_AGENCY_MONTHLY:       check('LS_VARIANT_AGENCY_MONTHLY'),
    LS_VARIANT_AGENCY_ANNUAL:        check('LS_VARIANT_AGENCY_ANNUAL'),
    RESEND_API_KEY:                  check('RESEND_API_KEY'),
    EMAIL_FROM:                      check('EMAIL_FROM'),
    NEXT_PUBLIC_APP_URL:             check('NEXT_PUBLIC_APP_URL'),
    VERCEL_ENV:                      process.env['VERCEL_ENV'] ?? '(not set)',
    NODE_ENV:                        process.env['NODE_ENV'],
  })
}