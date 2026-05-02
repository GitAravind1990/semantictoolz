import { NextRequest, NextResponse } from 'next/server'
import { paddle, getPlanFromPriceId } from '@/lib/paddle'
import { prisma } from '@/lib/prisma'
import { Plan } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('paddle-signature') ?? ''

  const webhookSecret = process.env['PADDLE_WEBHOOK_SECRET']
  if (!webhookSecret) {
    console.error('[Paddle Webhook] PADDLE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: ReturnType<typeof paddle.webhooks.unmarshal>
  try {
    event = paddle.webhooks.unmarshal(rawBody, webhookSecret, signature)
  } catch (err) {
    console.error('[Paddle Webhook] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  if (!event) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
  }

  console.log(`[Paddle Webhook] Event: ${event.eventType}`)

  try {
    const eventType = event.eventType

    if (eventType === 'subscription.created' || eventType === 'subscription.updated') {
      const sub = event.data as any
      const customData = sub.customData as { userId?: string; clerkId?: string } | null
      const priceId: string = sub.items?.[0]?.price?.id ?? ''
      const planKey = getPlanFromPriceId(priceId)
      const plan = Plan[planKey]
      const status = mapStatus(sub.status)
      const periodEnd: Date | null = sub.currentBillingPeriod?.endsAt
        ? new Date(sub.currentBillingPeriod.endsAt)
        : null

      const userId = await resolveUserId(customData?.userId, customData?.clerkId, sub.customerId)
      if (userId) {
        await prisma.subscription.upsert({
          where: { paddleSubscriptionId: sub.id },
          create: {
            userId,
            paddleSubscriptionId: sub.id,
            paddleCustomerId: sub.customerId,
            paddlePriceId: priceId,
            status,
            plan,
            currentPeriodEnd: periodEnd,
          },
          update: {
            paddlePriceId: priceId,
            paddleCustomerId: sub.customerId,
            status,
            plan,
            currentPeriodEnd: periodEnd,
          },
        })
        await prisma.user.update({ where: { id: userId }, data: { plan } })
        console.log(`[Paddle Webhook] Upserted subscription ${sub.id} → ${planKey}`)
      }
    } else if (eventType === 'subscription.canceled') {
      const sub = event.data as any
      await prisma.subscription.updateMany({
        where: { paddleSubscriptionId: sub.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      })
      const record = await prisma.subscription.findUnique({
        where: { paddleSubscriptionId: sub.id },
      })
      if (record) {
        await prisma.user.update({ where: { id: record.userId }, data: { plan: Plan.FREE } })
      }
      console.log(`[Paddle Webhook] Cancelled subscription ${sub.id}`)
    } else if (eventType === 'subscription.paused') {
      const sub = event.data as any
      await prisma.subscription.updateMany({
        where: { paddleSubscriptionId: sub.id },
        data: { status: 'PAUSED' },
      })
    } else if (eventType === 'subscription.resumed') {
      const sub = event.data as any
      const priceId: string = sub.items?.[0]?.price?.id ?? ''
      const planKey = getPlanFromPriceId(priceId)
      const plan = Plan[planKey]
      await prisma.subscription.updateMany({
        where: { paddleSubscriptionId: sub.id },
        data: { status: 'ACTIVE', plan },
      })
      const record = await prisma.subscription.findUnique({
        where: { paddleSubscriptionId: sub.id },
      })
      if (record) {
        await prisma.user.update({ where: { id: record.userId }, data: { plan } })
      }
    } else {
      console.log(`[Paddle Webhook] Unhandled event: ${eventType}`)
    }
  } catch (err) {
    console.error('[Paddle Webhook] Processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

function mapStatus(paddleStatus: string): 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAST_DUE' | 'PAUSED' {
  const map: Record<string, 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAST_DUE' | 'PAUSED'> = {
    active: 'ACTIVE',
    canceled: 'CANCELLED',
    past_due: 'PAST_DUE',
    paused: 'PAUSED',
    trialing: 'ACTIVE',
  }
  return map[paddleStatus] ?? 'ACTIVE'
}

async function resolveUserId(
  userId?: string,
  clerkId?: string,
  paddleCustomerId?: string
): Promise<string | null> {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) return user.id
  }
  if (clerkId) {
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (user) return user.id
  }
  if (paddleCustomerId) {
    const sub = await prisma.subscription.findFirst({ where: { paddleCustomerId } })
    if (sub) return sub.userId
  }
  return null
}
