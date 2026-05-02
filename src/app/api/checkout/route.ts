import { NextRequest } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { paddle } from '@/lib/paddle'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiError({ message: 'Not authenticated', status: 401, name: 'AuthError' })

    const { priceId } = await req.json()
    if (!priceId) return apiError(new Error('priceId is required'))

    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''

    let user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      user = await prisma.user.create({ data: { clerkId, email } })
    }

    const transaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customer: { email },
      customData: { userId: user.id, clerkId },
    } as any)

    const checkoutUrl = (transaction as any).checkout?.url
      ?? `https://checkout.paddle.com/checkout/custom/${transaction.id}`

    return apiSuccess({ url: checkoutUrl })
  } catch (e) {
    return apiError(e)
  }
}
