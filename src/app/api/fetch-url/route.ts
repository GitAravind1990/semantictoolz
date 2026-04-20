import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError, apiSuccess } from '@/lib/api'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return apiError({ message: 'Not authenticated', status: 401, name: 'AuthError' })

    const { url } = await req.json()
    if (!url) return apiError(new Error('URL is required'))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SemanticToolz/2.0)' },
    })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)

    const html = await res.text()

    // Server-side HTML stripping (no DOM available in Node)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 6000)

    if (text.length < 100) throw new Error('Could not extract enough content from that URL')

    return apiSuccess({ content: text })
  } catch (e) {
    return apiError(e)
  }
}
