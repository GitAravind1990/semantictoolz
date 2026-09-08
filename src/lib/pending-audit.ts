/**
 * Carries a free-audit result across signup.
 *
 * The free audit is the main entry point — it needs no account, so most visitors meet the
 * product there. Before this, someone who ran an audit and then signed up landed on an empty
 * dashboard and had to retype the URL they had just analysed. The value they came for was one
 * click away and they were asked to start over.
 *
 * Stores only what is needed to resume: the URL and the score. The findings are not carried,
 * because the signed-in analyser produces its own and a stale copy would contradict them.
 */

const KEY = 'optmizly_pending_audit'

/** Long enough to survive signup, email confirmation and a distraction; short enough that a
 *  URL from last week does not ambush someone weeks later. */
export const PENDING_AUDIT_WINDOW_HOURS = 48

export type PendingAudit = { url: string; score: number; at: number }

/** Accepts only what could plausibly have come from our own audit form. */
function isUsable(v: unknown): v is PendingAudit {
  if (!v || typeof v !== 'object') return false
  const a = v as PendingAudit
  return typeof a.url === 'string'
    && /^https?:\/\/\S+$/i.test(a.url)
    && a.url.length <= 2048
    && typeof a.score === 'number'
    && Number.isFinite(a.score)
    && typeof a.at === 'number'
}

export function savePendingAudit(url: string, score: number): void {
  try {
    const payload: PendingAudit = { url, score, at: Date.now() }
    if (!isUsable(payload)) return
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Private mode, or storage disabled. The audit still displayed, which is the main thing.
  }
}

export function readPendingAudit(): PendingAudit | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isUsable(parsed)) return null
    if (Date.now() - parsed.at > PENDING_AUDIT_WINDOW_HOURS * 3_600_000) {
      window.localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Called once the offer has been taken or dismissed, so it cannot reappear on every visit. */
export function clearPendingAudit(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing to do; the window expiry will clear it eventually.
  }
}
