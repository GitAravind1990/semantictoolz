import crypto from 'crypto'
import { prisma } from './prisma'
import { Plan } from '@prisma/client'

// Module-level diagnostic: fires on first import, not per-request
console.log('[LS-Module] lemonsqueezy.ts loaded')
console.log('[LS-Module] LEMONSQUEEZY_WEBHOOK_SECRET at module load:', process.env.LEMONSQUEEZY_WEBHOOK_SECRET ? `set (${process.env.LEMONSQUEEZY_WEBHOOK_SECRET.length} chars)` : 'MISSING')
console.log('[LS-Module] LEMONSQUEEZY_API_KEY at module load:', process.env.LEMONSQUEEZY_API_KEY ? 'set' : 'MISSING')

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
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  // --- deep diagnostic dump ---
  console.log('[LS-Webhook] === verifyWebhookSignature ===')
  console.log('[LS-Webhook] VERCEL_ENV:', process.env.VERCEL_ENV ?? '(not set)')
  console.log('[LS-Webhook] NODE_ENV:', process.env.NODE_ENV)
  console.log('[LS-Webhook] secret defined:', secret !== undefined)
  console.log('[LS-Webhook] secret typeof:', typeof secret)
  console.log('[LS-Webhook] secret raw length:', secret?.length ?? 'n/a')
  console.log('[LS-Webhook] secret trimmed length:', secret?.trim().length ?? 'n/a')
  console.log('[LS-Webhook] secret has leading/trailing whitespace:', secret !== secret?.trim())
  console.log('[LS-Webhook] secret preview:', secret ? `${secret.slice(0, 4)}...${secret.slice(-4)}` : '(none)')
  console.log('[LS-Webhook] LEMON* env keys:', Object.keys(process.env).filter(k => k.includes('LEMON')))
  console.log('[LS-Webhook] key in Object.keys:', Object.keys(process.env).includes('LEMONSQUEEZY_WEBHOOK_SECRET'))
  console.log('[LS-Webhook] signature defined:', !!signature)
  console.log('[LS-Webhook] signature length:', signature.length)
  console.log('[LS-Webhook] signature preview:', signature ? `${signature.slice(0, 10)}...` : '(none)')
  console.log('[LS-Webhook] payload length:', payload.length)

  const effectiveSecret = secret?.trim()

  if (!effectiveSecret) {
    console.error('[LS-Webhook] FATAL: LEMONSQUEEZY_WEBHOOK_SECRET is missing or blank')
    console.error('[LS-Webhook] All env keys:', Object.keys(process.env).sort().join(', '))
    return false
  }

  try {
    const hmac = crypto.createHmac('sha256', effectiveSecret)
    const digest = hmac.update(payload).digest('hex')
    console.log('[LS-Webhook] computed digest length:', digest.length)
    console.log('[LS-Webhook] computed digest preview:', `${digest.slice(0, 10)}...`)
    console.log('[LS-Webhook] provided sig length:', signature.length)

    if (digest.length !== signature.length) {
      console.error(`[LS-Webhook] length mismatch — digest: ${digest.length}, signature: ${signature.length}`)
      return false
    }

    const match = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
    console.log('[LS-Webhook] signature match:', match)
    return match
  } catch (e) {
    console.error('[LS-Webhook] verification threw:', e)
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