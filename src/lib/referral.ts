/**
 * Referral attribution: capture `?ref=` on any page, carry it to checkout.
 *
 * There is no partner programme yet and nothing pays out. This records who sent a customer so
 * that when the programme launches there is history rather than a standing start — see the
 * Agency Partner Program design. Deliberately the cheapest possible version: no partner table,
 * no dashboard, no commission accounting.
 *
 * The value rides on Dodo's checkout metadata, which was verified to persist onto the
 * subscription object, so the webhook receives it without any extra lookup.
 */

const KEY = 'optmizly_ref'

/** How long a referral stays credited. */
export const REFERRAL_WINDOW_DAYS = 60

/**
 * Referral codes are attacker-supplied — anyone can put anything in a query string, and this
 * ends up in third-party metadata and our database. Restricted to a conservative shape rather
 * than escaped: a partner code has no reason to contain anything else.
 */
export function sanitizeRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return null
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(trimmed)) return null
  return trimmed
}

type Stored = { ref: string; at: number }

/**
 * Records a referral seen in the URL. Last-click wins, which is the industry norm and the one
 * a partner will expect to be judged by; a fresh visit through a partner link re-credits them.
 *
 * Every storage access is guarded: localStorage throws outright in some privacy modes, and a
 * referral is never important enough to break a page load over.
 */
export function captureRef(search: string): void {
  try {
    const ref = sanitizeRef(new URLSearchParams(search).get('ref'))
    if (!ref) return
    const payload: Stored = { ref, at: Date.now() }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // No storage, no attribution. The purchase still works, which is what matters.
  }
}

/** The active referral, or null when absent, malformed or past the window. */
export function readRef(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored
    const ref = sanitizeRef(parsed?.ref)
    if (!ref || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > REFERRAL_WINDOW_DAYS * 86_400_000) {
      window.localStorage.removeItem(KEY)
      return null
    }
    return ref
  } catch {
    return null
  }
}
