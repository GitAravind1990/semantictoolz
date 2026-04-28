import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, handleWebhookEvent, getPlanFromProduct } from '@/lib/creem'
import { prisma } from '@/lib/prisma'
import { sendSubscriptionEmail, sendCancelledEmail } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text()
    const signature = req.headers.get('creem-signature') ?? ''

    console.log('[Creem-Webhook] POST received — VERCEL_ENV:', process.env.VERCEL_ENV ?? '(not set)')
    console.log('[Creem-Webhook] webhook secret set at route entry:', !!process.env.CREEM_WEBHOOK_SECRET)
    console.log('[Creem-Webhook] creem-signature header:', signature ? `${signature.slice(0, 10)}...` : '(empty)')

    if (!verifyWebhookSignature(payload, signature)) {
      console.error('[Creem-Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(payload)
    const eventType = body.eventType as string
    const obj = (body.object ?? {}) as Record<string, unknown>

    console.log(`[Creem-Webhook] Event: ${eventType}`)

    const handledEvents = [
      'subscription.active',
      'subscription.update',
      'subscription.canceled',
      'subscription.expired',
      'subscription.past_due',
      'subscription.paused',
    ]

    if (handledEvents.includes(eventType)) {
      await handleWebhookEvent(eventType, obj)

      // Transactional emails
      const metadata = (obj.metadata ?? {}) as Record<string, unknown>
      const userId = metadata.userId as string | undefined

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (user) {
          const product = (obj.product ?? {}) as Record<string, unknown>
          const productId = String(product.id ?? '')
          const plan = getPlanFromProduct(productId)
          const planLabel = plan === 'AGENCY' ? 'Agency' : 'Pro'
          const amount = plan === 'AGENCY' ? '$49/month' : '$19/month'

          if (eventType === 'subscription.active') {
            await sendSubscriptionEmail(user.email, planLabel as 'Pro' | 'Agency', amount)
          } else if (eventType === 'subscription.canceled' || eventType === 'subscription.expired') {
            const endsAt = obj.current_period_end_date as string | undefined
            const accessUntil = endsAt
              ? new Date(endsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : undefined
            await sendCancelledEmail(user.email, planLabel, undefined, accessUntil)
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('[Creem-Webhook] Error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
