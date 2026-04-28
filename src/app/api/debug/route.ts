import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  return Response.json({
    hasDbUrl:            !!process.env.DATABASE_URL,
    hasClerkKey:         !!process.env.CLERK_SECRET_KEY,
    hasAnthropicKey:     !!process.env.ANTHROPIC_API_KEY,
    hasCreemApiKey:      !!process.env.CREEM_API_KEY,
    hasCreemWebhookSecret: !!process.env.CREEM_WEBHOOK_SECRET,
    creemWebhookSecretLength: process.env.CREEM_WEBHOOK_SECRET?.length ?? 0,
    creemTestMode:       process.env.CREEM_TEST_MODE ?? 'false',
    nodeEnv:             process.env.NODE_ENV,
    vercelEnv:           process.env.VERCEL_ENV ?? '(not set)',
  })
}
