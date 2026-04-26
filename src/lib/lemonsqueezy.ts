import crypto from 'crypto'
import { prisma } from './prisma'
import { Plan } from '@prisma/client'

const LS_API = 'https://api.lemonsqueezy.com/v1'

function lsHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.api+json',
    Accept: 'application/vnd.api+json',
  }
  if (process.env.LEMONSQUEEZY_API_KEY) {
    headers.Authorization = `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
  }
  return headers
}

function buildVariantMap(): Record<string, Plan> {
  return {
    [process.env.LS_VARIANT_PRO_MONTHLY ?? '']: Plan.PRO,
    [process.env.LS_VARIANT_PRO_ANNUAL ?? '']: Plan.PRO,
    [process.env.LS_VARIANT_AGENCY_MONTHLY ?? '']: Plan.AGENCY,
    [process.env.LS_VARIANT_AGENCY_ANNUAL ?? '']: Plan.AGENCY,
  }
}

export function getPlanFromVariant(variantId: string): Plan {
  return buildVariantMap()[variantId] ?? Plan.FREE
}

export async function createCheckout(
  variantId: string,
  userId: string,
  email: string,
  appUrl: string
): Promise<string> {
  if (!process.env.LEMONSQUEEZY_API_KEY) {
    throw new Error('Lemon Squeezy API key not configured')
  }

  const res = await fetch(`${LS_API}/checkouts`, {
    method: 'POST',
    headers: lsHeaders(),
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email,
            custom: { user_id: userId },
          },
          checkout_options: { embed: false, media: false },
          product_options: {
            redirect_url: `${appUrl}/dashboard?upgrade=success`,
            receipt_button_text: 'Open SemanticToolz',
            receipt_link_url: `${appUrl}/dashboard`,
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: process.env.LEMONSQUEEZY_STORE_ID } },
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Checkout creation failed: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return data.data.attributes.url as string
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    return false
  }
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function handleWebhookEvent(
  eventName: string,
  data: Record<string, unknown>,
  customDataParam?: Record<string, unknown>
) {
  const attrs = (data.attributes ?? {}) as Record<string, unknown>
  const customData = customDataParam ?? ((data.meta as any)?.custom_data ?? {}) as Record<string, unknown>

  const userId = customData.user_id as string | undefined
  const lsSubId = String(data.id ?? '')
  const lsCustomerId = String(attrs.customer_id ?? '')

  const firstItem = (attrs.first_subscription_item ?? {}) as Record<string, unknown>
  const variantId = String(firstItem.variant_id ?? attrs.variant_id ?? '')
  const plan = getPlanFromVariant(variantId)

  console.log(`[Webhook] Event: ${eventName}, UserId: ${userId}, VariantId: ${variantId}, Plan: ${plan}`)

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated': {
      if (!userId) {
        console.error('[Webhook] No userId in custom_data')
        break
      }

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        console.error(`[Webhook] User not found: ${userId}`)
        break
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { plan },
        }),
        prisma.subscription.upsert({
          where: { lsSubscriptionId: lsSubId },
          create: {
            userId,
            lsSubscriptionId: lsSubId,
            lsCustomerId,
            lsVariantId: variantId,
            status: 'ACTIVE',
            plan,
          },
          update: { status: 'ACTIVE', plan, lsVariantId: variantId },
        }),
      ])

      console.log(`[Webhook] User ${userId} upgraded to ${plan}`)
      break
    }

    case 'subscription_cancelled':
    case 'subscription_expired': {
      const sub = await prisma.subscription.findUnique({ where: { lsSubscriptionId: lsSubId } })
      if (!sub) break

      await prisma.$transaction([
        prisma.user.update({ where: { id: sub.userId }, data: { plan: Plan.FREE } }),
        prisma.subscription.update({
          where: { lsSubscriptionId: lsSubId },
          data: {
            status: eventName === 'subscription_cancelled' ? 'CANCELLED' : 'EXPIRED',
            cancelledAt: new Date(),
          },
        }),
      ])
      break
    }

    case 'subscription_payment_failed': {
      const sub = await prisma.subscription.findUnique({ where: { lsSubscriptionId: lsSubId } })
      if (!sub) break

      await prisma.subscription.update({
        where: { lsSubscriptionId: lsSubId },
        data: { status: 'PAST_DUE' },
      })
      break
    }
  }
}