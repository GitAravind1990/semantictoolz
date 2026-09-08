import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError, apiSuccess } from '@/lib/api'
import { AuthError } from '@/lib/auth'
import { validateUrl } from '@/lib/ssrf-guard'

export const runtime = 'nodejs'

/**
 * Summarises the markup signals before they are stripped.
 *
 * The analyser scores eight dimensions, four of which — technical SEO, on-page SEO, structured
 * data and E-E-A-T — measure things that live only in markup. extractMainContent removes every
 * tag, so those four were being scored against text where the evidence could not exist, and
 * they returned near-zero for every URL regardless of the page.
 *
 * Measured before this existed: Google's own SEO starter guide scored 15/100 and Moz's
 * beginners guide 28/100, both grade D, while their prose-based dimensions scored 40-45. A user
 * analysing a page they know is good got a D and reasonably concluded the tool was broken.
 *
 * This reports what is present, not whether it is good — the analyser still judges. Absence is
 * stated explicitly rather than omitted, because "no author markup" is itself the finding, and
 * a silent omission would read as an unanswered question.
 */
function extractPageSignals(html: string, finalUrl: string): string {
  const head = html.slice(0, 200_000)
  const one = (re: RegExp): string | null => {
    const m = head.match(re)
    return m?.[1]?.trim().replace(/\s+/g, ' ').slice(0, 300) || null
  }

  const title = one(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const desc = one(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    ?? one(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
  const canonical = one(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)
  const ogTitle = one(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)

  // Schema.org @type values, which is what "does this page have structured data" actually means.
  const ldTypes = new Set<string>()
  for (const m of head.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const t of (m[1] ?? '').matchAll(/"@type"\s*:\s*"([^"]+)"/g)) ldTypes.add(t[1])
  }

  // The heading outline, which carries the document structure that stripping destroys.
  const headings: string[] = []
  for (const m of head.matchAll(/<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = (m[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) headings.push(`${m[1].toUpperCase()}: ${text.slice(0, 90)}`)
    if (headings.length >= 15) break
  }

  const hasAuthor = /rel=["']author["']|name=["']author["']|"author"\s*:|class=["'][^"']*\bauthor\b/i.test(head)
  const hasDates = /datePublished|dateModified|<time[^>]+datetime=/i.test(head)

  return [
    '=== PAGE SIGNALS (read from the HTML before tags were stripped) ===',
    `URL: ${finalUrl}`,
    `Title: ${title ?? 'MISSING'}`,
    `Meta description: ${desc ?? 'MISSING'}`,
    `Canonical: ${canonical ?? 'MISSING'}`,
    `Open Graph title: ${ogTitle ?? 'MISSING'}`,
    `Structured data (schema.org @type): ${ldTypes.size ? [...ldTypes].join(', ') : 'NONE FOUND'}`,
    `Author markup: ${hasAuthor ? 'present' : 'MISSING'}`,
    `Published/modified dates: ${hasDates ? 'present' : 'MISSING'}`,
    `Heading outline (${headings.length} found):`,
    ...(headings.length ? headings.map(h => `  ${h}`) : ['  NONE FOUND']),
    '=== PAGE CONTENT ===',
    '',
  ].join('\n')
}

function extractMainContent(html: string): string {
  // 1. Remove entire noise blocks (including their inner content)
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    // Remove common noise divs by class/id (ads, banners, sidebars, comments, popups)
    .replace(/<div[^>]+(?:class|id)="[^"]*(?:sidebar|widget|banner|advertisement|cookie|popup|modal|overlay|comment|related|social|share|subscribe|newsletter|promo|breadcrumb|pagination|tag-cloud|author-bio)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  // 2. Try to isolate main content — prefer <article>, <main>, then common content class patterns
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]+(?:class|id)="[^"]*(?:post-content|entry-content|article-content|blog-content|content-body|single-content|post-body|article-body|story-body|rich-text|prose|blog-post)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ]

  let contentHtml = cleaned
  for (const pattern of contentPatterns) {
    const match = cleaned.match(pattern)
    if (match) {
      contentHtml = match[1]
      break
    }
  }

  // 3. Strip all remaining HTML tags
  let text = contentHtml.replace(/<[^>]+>/g, ' ')

  // 4. Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))

  // 5. Remove leftover symbols, control characters, and excessive whitespace
  text = text
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')  // keep printable ASCII + newlines
    .replace(/[ \t]+/g, ' ')               // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')            // max 2 consecutive newlines
    .trim()

  return text
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    try {
      await validateUrl(url)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid URL' },
        { status: 400 }
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Optmizly/2.0)' },
    })
    clearTimeout(timeout)

    // AuthError, not a bare Error. `apiError` matches none of its branches on a plain Error and
    // falls through to a generic 500 "Internal server error", discarding the message — so a
    // mistyped URL was reported to the user as OUR server failing. Observed live: a 404 on the
    // target page surfaced in the dashboard as "Internal server error", which is wrong about
    // whose fault it is and gives the user nothing to act on.
    if (!res.ok) {
      throw new AuthError(
        422,
        res.status === 404
          ? 'That page returned 404 — check the URL and try again.'
          : res.status === 403 || res.status === 401
          ? 'That site refused our request. Some sites block automated readers; paste the text instead.'
          : `That page could not be loaded (HTTP ${res.status}). Try another URL, or paste the text instead.`,
      )
    }

    const html = await res.text()
    // Signals first, from the intact HTML. The length check below still measures the prose
    // alone, so a page with rich markup and no readable text is still correctly rejected
    // rather than passing on the strength of its meta tags.
    const text = extractMainContent(html).slice(0, 50000)

    // Also an AuthError for the same reason. This one fires most often on JavaScript-rendered
    // pages, where the HTML carries almost no text — so the message names that cause rather
    // than implying the page is empty.
    if (text.length < 100) {
      throw new AuthError(
        422,
        'We could not read enough text from that page. It may render its content with JavaScript — paste the text instead.',
      )
    }

    // Signals prepended to the prose, so the analyser scores the markup dimensions against
    // what the page actually declares rather than against text those tags were removed from.
    return apiSuccess({ content: extractPageSignals(html, res.url || url) + text })
  } catch (e) {
    return apiError(e)
  }
}

