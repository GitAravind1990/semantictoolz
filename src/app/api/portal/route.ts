import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getCustomerPortalUrl } from '@/lib/creem'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiError({ message: 'Not authenticated', status: 401, name: 'AuthError' })

    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { subscription: true },
    })

    if (!user?.subscription?.creemCustomerId) {
      return apiError(new Error('No active subscription found'))
    }

    const url = await getCustomerPortalUrl(user.subscription.creemCustomerId)
    return apiSuccess({ url })
  } catch (e) {
    return apiError(e)
  }
}
