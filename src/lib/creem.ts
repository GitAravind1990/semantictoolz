import crypto from 'crypto'
import { prisma } from './prisma'
import { Plan } from '@prisma/client'

const CREEM_API = process.env.CREEM_TEST_MODE === 'true'
  ? 'https://test-api.creem.io/v1'
  : 'https://api.creem.io/v1'

function creemHeaders(): Record<string, string> {
  return {
    'x-api-key': process.env.CREEM_API_KEY ?? '',
    'Content-Type': 'application/json',
  }
}

function buildProductMap(): Record<string, Plan> {
  return {
    [process.env.CREEM_PRODUCT_PRO_MONTHLY ?? '']:     Plan.PRO,
    [process.env.CREEM_PRODUCT_PRO_ANNUAL ?? '']:      Plan.PRO,
    [process.env.CREEM_PRODUCT_AGENCY_MONTHLY ?? '']:  Plan.AGENCY,
    [process.env.CREEM_PRODUCT_AGENCY_ANNUAL ?? '']:   Plan.AGENCY,
  }
}

export function getPlanFromProduct(productId: string): Plan {
  return buildProductMap()[productId] ?? Plan.FREE
}

export async function createCheckout(
  productId: string,
  userId: string,
  email: string,
  appUrl: string
): Promise<string> {
  if (!process.env.CREEM_API_KEY) {
    throw new Error('CREEM_API_KEY is not configured')
  }

  const res = await fetch(`${CREEM_API}/checkouts`, {
    method: 'POST',
    headers: creemHeaders(),
    body: JSON.stringify({
      product_id: productId,
      success_url: `${appUrl}/dashboard?upgrade=success`,
      customer: { email },
      metadata: { userId },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Creem checkout creation failed: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const url = data.checkout_url as string | undefined
  if (!url) throw new Error('Creem returned no checkout_url')
  return url
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET

  console.log('[Creem-Webhook] === verifyWebhookSignature ===')
  console.log('[Creem-Webhook] VERCEL_ENV:', process.env.VERCEL_ENV ?? '(not set)')
  console.log('[Creem-Webhook] secret defined:', secret !== undefined)
  console.log('[Creem-Webhook] secret length:', secret?.length ?? 'n/a')
  console.log('[Creem-Webhook] secret has whitespace:', secret !== secret?.trim())
  console.log('[Creem-Webhook] signature length:', signature.length)
  console.log('[Creem-Webhook] signature preview:', signature ? `${signature.slice(0, 10)}...` : '(none)')

  const effectiveSecret = secret?.trim()

  if (!effectiveSecret) {
    console.error('[Creem-Webhook] FATAL: CREEM_WEBHOOK_SECRET is missing or blank')
    console.error('[Creem-Webhook] All env keys:', Object.keys(process.env).sort().join(', '))
    return false
  }

  try {
    const digest = crypto.createHmac('sha256', effectiveSecret).update(payload).digest('hex')
    console.log('[Creem-Webhook] digest preview:', `${digest.slice(0, 10)}...`)

    if (digest.length !== signature.length) {
      console.error(`[Creem-Webhook] length mismatch — digest: ${digest.length}, sig: ${signature.length}`)
      return false
    }

    const match = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
    console.log('[Creem-Webhook] match:', match)
    return match
  } catch (e) {
    console.error('[Creem-Webhook] verification threw:', e)
    return false
  }
}

export async function getCustomerPortalUrl(creemCustomerId: string): Promise<string> {
  const res = await fetch(`${CREEM_API}/customers/billing`, {
    method: 'POST',
    headers: creemHeaders(),
    body: JSON.stringify({ customer_id: creemCustomerId }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Failed to fetch Creem customer portal: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const url = data.customer_portal_link as string | undefined
  if (!url) throw new Error('Creem returned no customer_portal_link')
  return url
}

export async function handleWebhookEvent(eventType: string, obj: Record<string, unknown>) {
  const metadata = (obj.metadata ?? {}) as Record<string, unknown>
  const userId = metadata.userId as string | undefined

  const creemSubId = String(obj.id ?? '')
  const customer = (obj.customer ?? {}) as Record<string, unknown>
  const creemCustomerId = String(customer.id ?? '')
  const product = (obj.product ?? {}) as Record<string, unknown>
  const creemProductId = String(product.id ?? '')
  const plan = getPlanFromProduct(creemProductId)

  console.log(`[Creem-Webhook] Event: ${eventType}, userId: ${userId}, product: ${creemProductId}, plan: ${plan}`)

  switch (eventType) {
    case 'subscription.active':
    case 'subscription.update': {
      if (!userId) {
        console.error('[Creem-Webhook] No userId in metadata')
        break
      }

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        console.error(`[Creem-Webhook] User not found: ${userId}`)
        break
      }

      const periodEnd = obj.current_period_end_date
        ? new Date(obj.current_period_end_date as string)
        : undefined

      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { plan } }),
        prisma.subscription.upsert({
          where: { creemSubscriptionId: creemSubId },
          create: {
            userId,
            creemSubscriptionId: creemSubId,
            creemCustomerId,
            creemProductId,
            status: 'ACTIVE',
            plan,
            currentPeriodEnd: periodEnd,
          },
          update: {
            status: 'ACTIVE',
            plan,
            creemProductId,
            creemCustomerId,
            currentPeriodEnd: periodEnd,
          },
        }),
      ])

      console.log(`[Creem-Webhook] User ${userId} upgraded to ${plan}`)
      break
    }

    case 'subscription.canceled':
    case 'subscription.expired': {
      const sub = await prisma.subscription.findUnique({ where: { creemSubscriptionId: creemSubId } })
      if (!sub) break

      await prisma.$transaction([
        prisma.user.update({ where: { id: sub.userId }, data: { plan: Plan.FREE } }),
        prisma.subscription.update({
          where: { creemSubscriptionId: creemSubId },
          data: {
            status: eventType === 'subscription.canceled' ? 'CANCELLED' : 'EXPIRED',
            cancelledAt: new Date(),
          },
        }),
      ])
      break
    }

    case 'subscription.past_due': {
      const sub = await prisma.subscription.findUnique({ where: { creemSubscriptionId: creemSubId } })
      if (!sub) break

      await prisma.subscription.update({
        where: { creemSubscriptionId: creemSubId },
        data: { status: 'PAST_DUE' },
      })
      break
    }

    case 'subscription.paused': {
      const sub = await prisma.subscription.findUnique({ where: { creemSubscriptionId: creemSubId } })
      if (!sub) break

      await prisma.subscription.update({
        where: { creemSubscriptionId: creemSubId },
        data: { status: 'PAUSED' },
      })
      break
    }
  }
}
