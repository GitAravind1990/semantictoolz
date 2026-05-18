import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // One-time migration: rename paddle* columns to dodo* in Subscription table
  const secret = req.headers.get('x-migrate-secret')
  if (secret !== 'migrate-dodo-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []

  const steps = [
    { sql: `ALTER TABLE "Subscription" RENAME COLUMN "paddleSubscriptionId" TO "dodoSubscriptionId"`, label: 'rename paddleSubscriptionId' },
    { sql: `ALTER TABLE "Subscription" RENAME COLUMN "paddleCustomerId" TO "dodoCustomerId"`, label: 'rename paddleCustomerId' },
    { sql: `ALTER TABLE "Subscription" RENAME COLUMN "paddlePriceId" TO "dodoProductId"`, label: 'rename paddlePriceId' },
    { sql: `ALTER TABLE "Subscription" RENAME COLUMN "paddleTransactionId" TO "dodoPaymentId"`, label: 'rename paddleTransactionId' },
    { sql: `DROP INDEX IF EXISTS "Subscription_paddleSubscriptionId_key"`, label: 'drop old unique index' },
    { sql: `CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_dodoSubscriptionId_key" ON "Subscription"("dodoSubscriptionId")`, label: 'create new unique index' },
    { sql: `DROP INDEX IF EXISTS "Subscription_paddleSubscriptionId_idx"`, label: 'drop old index' },
    { sql: `CREATE INDEX IF NOT EXISTS "Subscription_dodoSubscriptionId_idx" ON "Subscription"("dodoSubscriptionId")`, label: 'create new index' },
  ]

  for (const step of steps) {
    try {
      await prisma.$executeRawUnsafe(step.sql)
      results.push(`OK: ${step.label}`)
    } catch (e: any) {
      results.push(`SKIP (${step.label}): ${e.message?.split('\n')[0]}`)
    }
  }

  return NextResponse.json({ results })
}
