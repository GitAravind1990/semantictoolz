import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { QueriesClient } from './client'

export default async function QueriesPage() {
  const { userId: clerkId } = await auth()
  const user = clerkId ? await prisma.user.findUnique({ where: { clerkId } }) : null
  const unlocked = user?.plan === 'PRO' || user?.plan === 'AGENCY'
  return <QueriesClient unlocked={unlocked} />
}
