import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  return Response.json({
    hasDbUrl: !!process.env.DATABASE_URL,
    hasClerkKey: !!process.env.CLERK_SECRET_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasLsApiKey: !!process.env.LEMONSQUEEZY_API_KEY,
    hasLsStoreId: !!process.env.LEMONSQUEEZY_STORE_ID,
    hasLsWebhookSecret: !!process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
    webhookSecretLength: process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.length || 0,
    nodeEnv: process.env.NODE_ENV,
  })
}