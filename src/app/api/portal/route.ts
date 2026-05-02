import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiError({ message: 'Not authenticated', status: 401, name: 'AuthError' })

    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { subscription: true },
    })

    if (!user?.subscription?.paddleCustomerId) {
      return apiError(new Error('No active subscription found'))
    }

    const { paddleCustomerId, paddleSubscriptionId } = user.subscription

    const res = await fetch(
      `https://api.paddle.com/customers/${paddleCustomerId}/portal-sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_ids: [paddleSubscriptionId] }),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err?.error?.detail ?? 'Could not create portal session')
    }

    const data = await res.json()
    const portalUrl = data?.data?.urls?.general?.overview
    if (!portalUrl) throw new Error('Portal URL not available')

    return apiSuccess({ url: portalUrl })
  } catch (e) {
    return apiError(e)
  }
}
