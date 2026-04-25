import { NextRequest } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createCheckout } from '@/lib/lemonsqueezy'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiError({ message: 'Not authenticated', status: 401, name: 'AuthError' })

    const { variantId } = await req.json()
    if (!variantId) return apiError(new Error('variantId is required'))

    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''

    // Get DB user ID
    let user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      user = await prisma.user.create({ data: { clerkId, email } })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const checkoutUrl = await createCheckout(variantId, user.id, email, appUrl)

    return apiSuccess({ url: checkoutUrl })
  } catch (e) {
    return apiError(e)
  }
}