'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { readPendingAudit, clearPendingAudit, type PendingAudit } from '@/lib/pending-audit'

/**
 * Picks up the URL someone audited before signing up.
 *
 * The free audit needs no account, so it is where most people meet the product. Without this
 * they arrive at an empty dashboard and have to retype the URL they analysed sixty seconds
 * ago — the worst possible first screen for someone who has just seen the tool work.
 *
 * Deliberately an offer, not an automatic run: firing an analysis on their behalf would spend
 * one of three free monthly credits without being asked.
 */
export function ContinueFromAudit({ onUse }: { onUse: (url: string) => void }) {
  // Read after mount, never during render: localStorage does not exist on the server, and
  // reading it during render would produce markup that cannot match the client.
  const [pending, setPending] = useState<PendingAudit | null>(null)

  useEffect(() => {
    setPending(readPendingAudit())
  }, [])

  if (!pending) return null

  const host = (() => {
    try { return new URL(pending.url).hostname.replace(/^www\./, '') } catch { return pending.url }
  })()

  function take() {
    if (!pending) return
    posthog.capture('audit_handoff_used', { score: pending.score })
    onUse(pending.url)
    clearPendingAudit()
    setPending(null)
  }

  function dismiss() {
    posthog.capture('audit_handoff_dismissed', { score: pending?.score })
    clearPendingAudit()
    setPending(null)
  }

  return (
    <div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">
            Pick up where you left off
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            You scored <span className="font-bold text-slate-900">{host}</span> at{' '}
            <span className="font-bold text-slate-900">{pending.score}/100</span> on AI search
            readiness. Run the full content analysis on it — 8 dimensions, not 6.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={dismiss}
            className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:text-slate-700"
          >
            Not now
          </button>
          <button
            onClick={take}
            className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-brand-700"
          >
            Analyse {host} →
          </button>
        </div>
      </div>
    </div>
  )
}
