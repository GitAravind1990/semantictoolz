'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { captureRef } from '@/lib/referral'

/**
 * Records `?ref=` wherever it appears on the site.
 *
 * Mounted once in the root layout rather than on the pricing page alone: a partner will link
 * to a blog post or a free tool far more often than to /pricing, and a referral that only
 * counts when someone lands on the pricing page would miss almost every real visit.
 *
 * Renders nothing. Re-runs on navigation so a client-side route change carrying ?ref= is
 * still seen.
 */
export function ReferralCapture() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    captureRef(searchParams.toString())
  }, [pathname, searchParams])

  return null
}
