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

    if (!user?.subscription?.lsCustomerId) {
      return apiError(new Error('No active subscription found'))
    }

    // Fetch the Lemon Squeezy customer portal URL
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/customers/${user.subscription.lsCustomerId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
          Accept: 'application/vnd.api+json',
        },
      }
    )

    if (!res.ok) throw new Error('Could not fetch customer portal URL')

    const data = await res.json()
    const portalUrl = data.data?.attributes?.urls?.customer_portal

    if (!portalUrl) throw new Error('Portal URL not available')

    return apiSuccess({ url: portalUrl })
  } catch (e) {
    return apiError(e)
  }
}
