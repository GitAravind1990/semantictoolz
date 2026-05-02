import { Paddle, Environment } from '@paddle/paddle-node-sdk'

if (typeof window !== 'undefined') {
  throw new Error('paddle.ts must only be used on the server')
}

export const paddle = new Paddle(process.env.PADDLE_API_KEY!, {
  environment: Environment.production,
})

export const PADDLE_PRICE_IDS = {
  PRO: process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID!,
  AGENCY: process.env.NEXT_PUBLIC_PADDLE_AGENCY_PRICE_ID!,
} as const

export function getPlanFromPriceId(priceId: string): 'PRO' | 'AGENCY' | 'FREE' {
  if (priceId === PADDLE_PRICE_IDS.AGENCY) return 'AGENCY'
  if (priceId === PADDLE_PRICE_IDS.PRO) return 'PRO'
  return 'FREE'
}
