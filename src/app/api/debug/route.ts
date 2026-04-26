import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  return Response.json({
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlLength: process.env.DATABASE_URL?.length || 0,
    dbUrlStart: process.env.DATABASE_URL?.substring(0, 50) || 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
    hasClerkKey: !!process.env.CLERK_SECRET_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    allDatabaseKeys: Object.keys(process.env).filter(k => 
      k.toLowerCase().includes('database') || 
      k.toLowerCase().includes('postgres')
    ),
  })
}