import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { SerpClient } from './client'

export default async function SerpPage() {
  const { userId: clerkId } = await auth()
  const user = clerkId ? await prisma.user.findUnique({ where: { clerkId } }) : null
  const unlocked = user?.plan === 'AGENCY'
  return <SerpClient unlocked={unlocked} />
}
