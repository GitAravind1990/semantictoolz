import { Plan } from '@prisma/client'

export const PLAN_LIMITS: Record<Plan, number> = {
  FREE: 3,
  PRO: 50,
  AGENCY: 200,
}

export const PLAN_TOOLS: Record<Plan, string[]> = {
  FREE: ['analyse'],
  PRO: ['analyse', 'optimizer'],
  AGENCY: ['analyse', 'optimizer'],
}

export function canUseTool(plan: Plan, tool: string): boolean {
  return PLAN_TOOLS[plan]?.includes(tool) ?? false
}

export function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
