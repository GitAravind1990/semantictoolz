import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/api'
import { dodoApiBase, dodoApiKey, dodoMode } from '@/lib/dodopayments'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiError({ message: 'Not authenticated', status: 401, name: 'AuthError' })

    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { subscription: true },
    })

    if (!user?.subscription?.dodoCustomerId) {
      // 404 with the real message, not a bare Error: apiError matches none of its
      // branches on a plain Error and falls through to a 500 "Internal server error",
      // which is what a Free user saw in an alert box when they clicked Manage billing.
      return apiError({ message: 'No active subscription found', status: 404, name: 'NotFound' })
    }

    // A portal SESSION, not a hand-built URL.
    //
    // This used to return `customer.dodopayments.com/subscriptions?customer_id=...`, which is
    // not an authenticated link: the page cannot identify the visitor, so it showed no
    // subscription and — the part that matters — **no way to cancel**. The Terms promise
    // cancellation "at any time from your account settings", so that was a broken promise,
    // not just a broken button. This endpoint returns a signed, expiring link that opens the
    // customer's own portal with billing and cancellation available.
    const { key, varName } = dodoApiKey()
    if (!key) {
      console.error(`[Portal] ${varName} not set (mode: ${dodoMode()})`)
      return apiError({ message: 'Billing is not configured', status: 500, name: 'ConfigError' })
    }

    const res = await fetch(
      `${dodoApiBase()}/customers/${user.subscription.dodoCustomerId}/customer-portal/session`,
      { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } },
    )

    if (!res.ok) {
      // Surfaced rather than swallowed: a customer who cannot reach the portal cannot cancel,
      // and a silent failure here looks identical to a plan with no cancel option at all.
      const detail = (await res.text()).slice(0, 300)
      console.error(`[Portal] session creation failed HTTP ${res.status}: ${detail}`)
      return apiError({ message: 'Could not open the billing portal. Please contact support.', status: 502, name: 'PortalError' })
    }

    const { link } = await res.json()
    if (!link) {
      console.error('[Portal] session response contained no link')
      return apiError({ message: 'Could not open the billing portal. Please contact support.', status: 502, name: 'PortalError' })
    }

    return apiSuccess({ url: link })
  } catch (e) {
    return apiError(e)
  }
}
