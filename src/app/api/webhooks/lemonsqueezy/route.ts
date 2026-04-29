import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, handleWebhookEvent, getPlanFromVariant } from '@/lib/lemonsqueezy'
import { prisma } from '@/lib/prisma'
import { sendSubscriptionEmail, sendCancelledEmail } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text()
    const signature = req.headers.get('x-signature') ?? ''

    // Read secret directly here — avoids any webpack static-analysis substitution in imported modules
    const webhookSecret = process.env['LEMONSQUEEZY_WEBHOOK_SECRET']

    console.log('[LS-Webhook] POST received — VERCEL_ENV:', process.env['VERCEL_ENV'] ?? '(not set)')
    console.log('[LS-Webhook] secret at route entry:', webhookSecret ? `set (${webhookSecret.length} chars)` : 'UNDEFINED')
    console.log('[LS-Webhook] x-signature header:', signature ? `${signature.slice(0, 10)}...` : '(empty)')
    console.log('[LS-Webhook] content-type:', req.headers.get('content-type'))

    if (!webhookSecret) {
      console.error('[LS-Webhook] FATAL: LEMONSQUEEZY_WEBHOOK_SECRET is not set in this function runtime')
      console.error('[LS-Webhook] All env keys with LEMON:', Object.keys(process.env).filter(k => k.includes('LEMON')))
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      console.error('[Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(payload)
    const eventName = body.meta?.event_name as string
    console.log(`[Webhook] Event: ${eventName}`)

    const supportedEvents = [
      'subscription_created',
      'subscription_updated',
      'subscription_cancelled',
      'subscription_expired',
      'subscription_payment_failed',
    ]

    if (supportedEvents.includes(eventName)) {
      // Pass custom_data from top-level meta
      await handleWebhookEvent(eventName, body.data, body.meta?.custom_data)

      // Send transactional emails
      const attrs = body.data?.attributes ?? {}
      const customData = body.meta?.custom_data ?? {}
      const userId = customData.user_id as string | undefined

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (user) {
          const variantId = String(
            (attrs.first_subscription_item as Record<string, unknown>)?.variant_id ?? attrs.variant_id ?? ''
          )
          const plan = getPlanFromVariant(variantId)
          const planLabel = plan === 'AGENCY' ? 'Agency' : 'Pro'
          const amount = plan === 'AGENCY' ? '$49/month' : '$19/month'

          if (eventName === 'subscription_created') {
            await sendSubscriptionEmail(user.email, planLabel as 'Pro' | 'Agency', amount)
          } else if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
            const accessUntil = attrs.ends_at
              ? new Date(attrs.ends_at as string).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : undefined
            await sendCancelledEmail(user.email, planLabel, undefined, accessUntil)
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('[Webhook] Error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}