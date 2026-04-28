import { Plan } from '@prisma/client'

export const PLAN_LIMITS: Record<Plan, number> = {
  FREE: 3,
  PRO: 50,
  AGENCY: 200,
}

export const PLAN_TOOLS: Record<Plan, string[]> = {
  FREE: ['analyse'],
  PRO: ['analyse', 'eeat', 'rewrite', 'backlinks', 'citation', 'gap', 'queries','optimizer'],
  AGENCY: ['analyse', 'eeat', 'rewrite', 'backlinks', 'citation', 'gap', 'queries', 'tracker', 'local', 'serp', 'topical', 'optimizer'],
}

export const PLAN_PRICES = {
  PRO_MONTHLY:     process.env.CREEM_PRODUCT_PRO_MONTHLY!,
  PRO_ANNUAL:      process.env.CREEM_PRODUCT_PRO_ANNUAL!,
  AGENCY_MONTHLY:  process.env.CREEM_PRODUCT_AGENCY_MONTHLY!,
  AGENCY_ANNUAL:   process.env.CREEM_PRODUCT_AGENCY_ANNUAL!,
}

export function canUseTool(plan: Plan, tool: string): boolean {
  return PLAN_TOOLS[plan]?.includes(tool) ?? false
}

export function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7) // "2025-06"
}
