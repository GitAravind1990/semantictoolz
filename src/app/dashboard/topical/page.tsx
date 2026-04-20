import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { TopicalClient } from './client'

export default async function TopicalPage() {
  const { userId: clerkId } = await auth()
  const user = clerkId ? await prisma.user.findUnique({ where: { clerkId } }) : null
  const unlocked = user?.plan === 'AGENCY'
  return <TopicalClient unlocked={unlocked} />
}
