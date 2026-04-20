import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { RewriteClient } from './client'

export default async function RewritePage() {
  const { userId: clerkId } = await auth()
  const user = clerkId ? await prisma.user.findUnique({ where: { clerkId } }) : null
  const unlocked = user?.plan === 'PRO' || user?.plan === 'AGENCY'
  return <RewriteClient unlocked={unlocked} />
}
