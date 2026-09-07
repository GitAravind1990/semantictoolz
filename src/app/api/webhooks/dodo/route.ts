import { NextRequest, NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import { getPlanFromProductId, dodoApiBase, dodoApiKey, dodoMode, dodoWebhookSecret } from '@/lib/dodopayments'
import { prisma } from '@/lib/prisma'
import { Plan } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog-server'
import { sendSubscriptionEmail, sendCancelledEmail, sendTrialStartedEmail } from '@/lib/email'
import { getClerkFirstName, isAlwaysAgency } from '@/lib/auth'
import { sanitizeRef } from '@/lib/referral'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Both credentials follow DODO_MODE. A test-mode deployment verifying against the live
  // secret would reject every test webhook as an invalid signature — the payment succeeds
  // in Dodo and the plan is never granted, which looks like a broken webhook rather than a
  // missing variable. Resolving both through the same mode keeps them from disagreeing.
  const { secret: webhookSecret, varName: secretVar } = dodoWebhookSecret()
  if (!webhookSecret) {
    console.error(`[Dodo Webhook] ${secretVar} not set (mode: ${dodoMode()})`)
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const { key: apiKey, varName: keyVar } = dodoApiKey()
  if (!apiKey) {
    console.error(`[Dodo Webhook] ${keyVar} not set (mode: ${dodoMode()})`)
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const dodoWebhook = new DodoPayments({
    bearerToken: apiKey,
    webhookKey: webhookSecret,
  })

  let event: any
  try {
    event = dodoWebhook.webhooks.unwrap(rawBody, {
      headers: {
        'webhook-id': req.headers.get('webhook-id') ?? '',
        'webhook-signature': req.headers.get('webhook-signature') ?? '',
        'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      },
    } as any)
  } catch (err) {
    console.error('[Dodo Webhook] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  if (!event) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
  }

  const eventType: string = event.type ?? event.eventType
  console.log(`[Dodo Webhook] Event: ${eventType}`)

  try {
    if (
      eventType === 'subscription.created' ||
      eventType === 'subscription.active' ||
      eventType === 'subscription.updated' ||
      eventType === 'subscription.renewed'
    ) {
      const sub = event.data
      const metadata = sub.metadata as { userId?: string; clerkId?: string; ref?: string } | null
      // Sanitised again on the way back in: this round-tripped through a third party, so it is
      // no more trustworthy here than it was at checkout.
      const referrer = sanitizeRef(metadata?.ref)
      const productId: string = sub.product_id ?? ''
      const planKey = getPlanFromProductId(productId)
      const plan = Plan[planKey]
      const periodEnd: Date | null = sub.next_billing_date
        ? new Date(sub.next_billing_date)
        : null
      const trialPeriodDays: number = sub.trial_period_days ?? 0

      const userId = await resolveUserId(
        metadata?.userId,
        metadata?.clerkId,
        sub.customer?.customer_id,
        sub.customer?.email,
      )

      if (userId) {
        const existingSub = await prisma.subscription.findUnique({ where: { userId } })

        // DoDo retries failed webhook deliveries with backoff, so an older
        // event can land after a newer one already succeeded. Ignore it
        // instead of clobbering the newer state with stale data.
        const eventTimestamp = event.timestamp ? new Date(event.timestamp) : new Date()
        const isStaleEvent = Boolean(
          existingSub?.lastWebhookEventAt && eventTimestamp < existingSub.lastWebhookEventAt,
        )
        const isNewCycle = !existingSub || existingSub.dodoSubscriptionId !== sub.subscription_id

        // A subscription.cancelled event can be delivered around the same
        // moment as a subscription.updated/active/renewed event for the same
        // underlying subscription (observed live during trial testing). If
        // this account is already cancelled in our DB and this event is for
        // that same DoDo subscription (not a fresh resubscription), don't
        // let it resurrect access -- the cancellation handler is the source
        // of truth once cancelled.
        const isAlreadyCancelled = existingSub?.status === 'CANCELLED' && !isNewCycle

        if (isStaleEvent) {
          console.log(
            `[Dodo Webhook] Ignoring stale event for subscription ${sub.subscription_id} ` +
            `(event ${eventTimestamp.toISOString()} older than last-applied ${existingSub!.lastWebhookEventAt!.toISOString()})`,
          )
        } else if (isAlreadyCancelled) {
          console.log(
            `[Dodo Webhook] Ignoring ${eventType} for already-cancelled subscription ${sub.subscription_id}`,
          )
        } else {
          const wasTrialing = existingSub?.status === 'TRIALING'

          // DoDo does not report a literal "trialing" status via the API in
          // practice (confirmed via live testing on 2026-07-16 -- status
          // stays "active" throughout, and trial_period_days is a static
          // config field that never changes even after conversion, so it
          // can't be used alone to tell "still trialing" from "already
          // converted"). Detect trial state ourselves: a fresh trial
          // subscription's first-ever webhook is TRIALING; later events on
          // the same subscription stay TRIALING only while the billing
          // cycle hasn't advanced past the trial-end date we stored: once
          // it has, that's the real conversion charge, and status is left
          // as ACTIVE (the mapStatus result) so the conversion-email branch
          // below fires correctly.
          const billingCycleAdvanced = Boolean(
            wasTrialing && existingSub?.currentPeriodEnd && periodEnd && periodEnd > existingSub.currentPeriodEnd,
          )
          let status = mapStatus(sub.status)
          if (trialPeriodDays > 0 && status === 'ACTIVE') {
            if (!existingSub) {
              status = 'TRIALING'
            } else if (wasTrialing && !billingCycleAdvanced) {
              status = 'TRIALING'
            }
          }

          // A cancellation can arrive here rather than in the subscription.cancelled branch:
          // Dodo sends subscription.updated carrying status "cancelled" when someone cancels
          // from the customer portal. mapStatus records that correctly, but this branch never
          // stamped cancelledAt — so a portal cancellation left it null while status said
          // CANCELLED. Observed live 2026-09-07. Nothing user-facing broke (the settings notice
          // and hasLapsed both key off status), but /api/admin/stats counts a null cancelledAt
          // as still-subscribed and never-churned, so churn silently under-reported.
          //
          // Cleared again on a genuinely new cycle, or a resubscribe would stay marked churned.
          const cancelStamp = status === 'CANCELLED'
            ? { cancelledAt: existingSub?.cancelledAt ?? eventTimestamp }
            : isNewCycle ? { cancelledAt: null } : {}

          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              dodoSubscriptionId: sub.subscription_id,
              dodoCustomerId: sub.customer?.customer_id ?? '',
              dodoProductId: productId,
              status,
              plan,
              currentPeriodEnd: periodEnd,
              welcomeEmailSent: false,
              trialConvertedEmailSent: false,
              lastWebhookEventAt: eventTimestamp,
              ...(status === 'CANCELLED' ? { cancelledAt: eventTimestamp } : {}),
              ...(referrer ? { referrer } : {}),
            },
            update: {
              dodoSubscriptionId: sub.subscription_id,
              dodoProductId: productId,
              dodoCustomerId: sub.customer?.customer_id ?? '',
              status,
              plan,
              currentPeriodEnd: periodEnd,
              lastWebhookEventAt: eventTimestamp,
              ...cancelStamp,
              // Written only when present, so a renewal that arrives without metadata cannot
              // erase the referrer recorded at signup. First attribution wins for the life of
              // the subscription; a new cycle re-attributes only if it carries its own ref.
              ...(referrer ? { referrer } : {}),
              ...(isNewCycle ? { welcomeEmailSent: false, trialConvertedEmailSent: false } : {}),
            },
          })
          // Fetched before the plan write so a pinned account can be recognised. getOrCreateUser
          // would restore Agency on the next request anyway, but leaving FREE in the database
          // makes the admin dashboard and every export disagree with what the user actually has.
          const dbUser = await prisma.user.findUnique({ where: { id: userId } })
          // Only a live subscription grants the plan. A declined or still-settling payment is
          // recorded on the subscription row but must not upgrade the account -- that was the
          // failed-card leak. Deliberately does NOT downgrade on a non-granting status either:
          // a mid-period PAST_DUE must not revoke access that Terms and the Refund Policy both
          // promise until currentPeriodEnd. Lapsing is handled by getOrCreateUser, on dates.
          if (!isAlwaysAgency(dbUser?.email) && GRANTS_ACCESS.has(status)) {
            await prisma.user.update({ where: { id: userId }, data: { plan } })
          }
          console.log(
            GRANTS_ACCESS.has(status)
              ? `[Dodo Webhook] Upserted subscription ${sub.subscription_id} → ${planKey}`
              : `[Dodo Webhook] Recorded ${sub.subscription_id} as ${status} (dodo: "${sub.status}") — plan NOT granted`,
          )

          if (dbUser) {
            if (dbUser.clerkId) {
              await captureServerEvent(dbUser.clerkId, 'subscription_activated', {
                plan: planKey,
                product_id: productId,
                $set: { plan: planKey },
              }).catch(() => {})
            }
            // Send the activation email exactly once per lifecycle stage. DoDo
            // doesn't reliably emit `subscription.created` before the
            // subscription goes active/trialing, and multiple subscription.*
            // events can land within milliseconds of each other for the same
            // activation -- so instead of gating on event type, atomically
            // claim each send via a conditional update. Only the request that
            // flips the flag false -> true (count === 1) sends the email,
            // which is race-safe under concurrent webhook deliveries.
            const firstName = await getClerkFirstName(dbUser.clerkId, dbUser.email.split('@')[0])
            const rawAmount = sub.recurring_pre_tax_amount
            // Fallback only — the payload's own amount is preferred. Listed per tier so a
            // missing amount cannot quote Starter at the Agency price.
            const fallbackAmount =
              planKey === 'STARTER' ? '$9'
              : planKey === 'PRO' ? '$19'
              : planKey === 'AGENCY_PLUS' ? '$99'
              : '$49'
            const amount = rawAmount ? `$${(rawAmount / 100).toFixed(0)}` : fallbackAmount
            const nextBilling = periodEnd
              ? periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : undefined
            // Explicit per tier, not "Agency or else Pro". That two-way form silently
            // called every non-Agency plan "Pro", so a Starter subscriber would have been
            // emailed a confirmation for a plan they did not buy.
            const planLabel =
              planKey === 'AGENCY_PLUS' ? 'Agency Plus'
              : planKey === 'AGENCY' ? 'Agency'
              : planKey === 'STARTER' ? 'Starter'
              : 'Pro'

            if (status === 'TRIALING') {
              const claimed = await prisma.subscription.updateMany({
                where: { userId, welcomeEmailSent: false },
                data: { welcomeEmailSent: true },
              })
              if (claimed.count === 1) {
                await sendTrialStartedEmail(
                  dbUser.email,
                  planLabel,
                  amount,
                  firstName,
                  nextBilling,
                ).catch(() => {})
              }
            } else if (status === 'ACTIVE' && wasTrialing) {
              const claimed = await prisma.subscription.updateMany({
                where: { userId, trialConvertedEmailSent: false },
                data: { trialConvertedEmailSent: true },
              })
              if (claimed.count === 1) {
                await sendSubscriptionEmail(
                  dbUser.email,
                  planLabel,
                  amount,
                  firstName,
                  nextBilling,
                ).catch(() => {})
              }
            } else if (status === 'ACTIVE') {
              const claimed = await prisma.subscription.updateMany({
                where: { userId, welcomeEmailSent: false },
                data: { welcomeEmailSent: true },
              })
              if (claimed.count === 1) {
                await sendSubscriptionEmail(
                  dbUser.email,
                  planLabel,
                  amount,
                  firstName,
                  nextBilling,
                ).catch(() => {})
              }
            }
          }
        }
      } else {
        console.warn('[Dodo Webhook] Could not resolve userId for subscription', sub.subscription_id)
      }
    } else if (eventType === 'subscription.cancelled') {
      const sub = event.data
      const eventTimestamp = event.timestamp ? new Date(event.timestamp) : new Date()

      // Same staleness/dedup reasoning as the created/updated/renewed branch above,
      // just never applied here: DoDo retries on any non-2xx/timeout, and a
      // cancellation can be delivered out of order against a later reactivation
      // (or simply retried after this handler already processed it once). Without
      // this, a late-arriving retry would unconditionally re-downgrade an active
      // user back to FREE and re-send the cancellation email a second time.
      const existingSub = await prisma.subscription.findUnique({ where: { dodoSubscriptionId: sub.subscription_id } })
      if (!existingSub) {
        console.warn(`[Dodo Webhook] Cancellation for unknown subscription ${sub.subscription_id}`)
      } else {
        const isStaleEvent = Boolean(existingSub.lastWebhookEventAt && eventTimestamp < existingSub.lastWebhookEventAt)
        const alreadyCancelled = existingSub.status === 'CANCELLED'

        if (isStaleEvent) {
          console.log(`[Dodo Webhook] Ignoring stale cancellation for ${sub.subscription_id} (event ${eventTimestamp.toISOString()} older than last-applied ${existingSub.lastWebhookEventAt!.toISOString()})`)
        } else if (alreadyCancelled) {
          console.log(`[Dodo Webhook] Subscription ${sub.subscription_id} already cancelled, skipping duplicate processing`)
        } else {
          await prisma.subscription.update({
            where: { id: existingSub.id },
            data: { status: 'CANCELLED', cancelledAt: new Date(), lastWebhookEventAt: eventTimestamp },
          })

          // Access is NOT revoked here. The customer has paid through
          // currentPeriodEnd, and the Terms, the Refund Policy and the cancellation
          // email sent a few lines below all promise access until that date — this
          // used to set FREE immediately and contradict all three, so cancelling on
          // day 2 of a paid month forfeited the rest of the month.
          //
          // The downgrade happens in getOrCreateUser() once the period has actually
          // elapsed. Only cancellations with nothing left to honour are applied now,
          // so a lapsed or period-less subscription still drops immediately.
          const stillPaidFor = existingSub.currentPeriodEnd && existingSub.currentPeriodEnd > new Date()
          if (!stillPaidFor) {
            await prisma.user.update({ where: { id: existingSub.userId }, data: { plan: Plan.FREE } })
          }
          console.log(
            `[Dodo Webhook] Cancelled subscription ${sub.subscription_id}` +
            (stillPaidFor ? ` (access retained until ${existingSub.currentPeriodEnd!.toISOString()})` : ' (downgraded immediately)')
          )

          const cancelledUser = await prisma.user.findUnique({ where: { id: existingSub.userId } })
          if (cancelledUser) {
            const firstName = await getClerkFirstName(cancelledUser.clerkId, cancelledUser.email.split('@')[0])
            const accessUntil = existingSub.currentPeriodEnd
              ? existingSub.currentPeriodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : undefined
            await sendCancelledEmail(cancelledUser.email, existingSub.plan, firstName, accessUntil).catch(() => {})
          }
        }
      }
    } else if (eventType.startsWith('refund.')) {
      /**
       * A refund returns the money, so it must also return the access.
       *
       * This is the one place access IS revoked mid-period, and it is deliberately the
       * opposite of the cancellation branch above. Cancelling keeps access because the
       * customer still paid for the period; a refund removes the payment that access rested
       * on, so keeping it would hand out a paid month for free.
       *
       * Only a FULL refund revokes. A partial one is recorded and left alone — the customer
       * has still paid for something, and guessing how much access a partial refund buys is
       * worse than leaving it intact and letting a human decide.
       */
      const refund = event.data
      const eventTimestamp = event.timestamp ? new Date(event.timestamp) : new Date()
      const refundStatus: string = refund?.status ?? ''
      if (refundStatus !== 'succeeded') {
        console.log(`[Dodo Webhook] Refund ${refund?.refund_id} is ${refundStatus || 'statusless'} — no action`)
      } else {
        // The refund payload does not say whether it clears the whole payment, so the
        // payment is read back: `refund_status` is 'full' or 'partial' there.
        const { key } = dodoApiKey()
        const paymentId: string = refund?.payment_id ?? ''
        let refundStatusOnPayment: string | null = null
        let subscriptionId: string | null = null

        if (key && paymentId) {
          const r = await fetch(`${dodoApiBase()}/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${key}` },
          })
          if (r.ok) {
            const payment = await r.json()
            refundStatusOnPayment = payment?.refund_status ?? null
            subscriptionId = payment?.subscription_id ?? null
          } else {
            console.error(`[Dodo Webhook] Could not read payment ${paymentId} for refund ${refund?.refund_id}: HTTP ${r.status}`)
          }
        }

        if (refundStatusOnPayment !== 'full') {
          console.log(`[Dodo Webhook] Refund ${refund?.refund_id} is ${refundStatusOnPayment ?? 'of unknown extent'} — access left intact`)
        } else if (!subscriptionId) {
          // A one-off payment rather than a subscription: nothing to revoke.
          console.log(`[Dodo Webhook] Refund ${refund?.refund_id} has no subscription — nothing to revoke`)
        } else {
          const refundedSub = await prisma.subscription.findUnique({ where: { dodoSubscriptionId: subscriptionId } })
          if (!refundedSub) {
            console.warn(`[Dodo Webhook] Refund for unknown subscription ${subscriptionId}`)
          } else {
            // currentPeriodEnd is moved to now rather than left in the future, so every
            // later read agrees the access is over — hasLapsed() is date-driven, and a
            // future date there would keep re-granting the plan.
            await prisma.subscription.update({
              where: { id: refundedSub.id },
              data: {
                status: 'EXPIRED',
                currentPeriodEnd: eventTimestamp,
                cancelledAt: refundedSub.cancelledAt ?? eventTimestamp,
                lastWebhookEventAt: eventTimestamp,
              },
            })

            const refundedUser = await prisma.user.findUnique({ where: { id: refundedSub.userId } })
            if (!isAlwaysAgency(refundedUser?.email)) {
              await prisma.user.update({ where: { id: refundedSub.userId }, data: { plan: Plan.FREE } })
            }
            console.log(`[Dodo Webhook] Full refund ${refund?.refund_id} — revoked ${refundedSub.plan} access for subscription ${subscriptionId}`)
          }
        }
      }
    } else {
      console.log(`[Dodo Webhook] Unhandled event: ${eventType}`)
    }
  } catch (err) {
    console.error('[Dodo Webhook] Processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

type SubStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAST_DUE' | 'PAUSED' | 'TRIALING'

/**
 * Dodo's subscription status → ours.
 *
 * **`failed` and `pending` are here because they were not, and the default was `ACTIVE`.**
 * Dodo creates the subscription when checkout starts, before the card settles, and fires a
 * webhook for it. A declined card therefore arrived as an unmapped status and was written
 * as ACTIVE, granting the paid plan to someone who had not paid. Observed live on
 * 2026-09-06: two declines at 10:00 and 10:03 created an ACTIVE STARTER row that only
 * corrected itself when a third attempt succeeded at 10:12. Had the customer given up after
 * the declines, they would have kept the plan indefinitely, and nothing would have logged.
 *
 * The default is now fail-closed. An unknown status that really means "active" costs a
 * customer their access and they will tell you within minutes; an unknown status silently
 * treated as active costs revenue and tells nobody.
 */
function mapStatus(dodoStatus: string): SubStatus {
  const map: Record<string, SubStatus> = {
    active: 'ACTIVE',
    cancelled: 'CANCELLED',
    expired: 'EXPIRED',
    past_due: 'PAST_DUE',
    paused: 'PAUSED',
    on_hold: 'PAST_DUE',
    trialing: 'TRIALING',
    failed: 'EXPIRED',
    pending: 'EXPIRED',
  }
  const mapped = map[dodoStatus]
  if (!mapped) {
    console.error(`[Dodo Webhook] Unknown subscription status "${dodoStatus}" — not granting access`)
    return 'EXPIRED'
  }
  return mapped
}

/**
 * The statuses that actually entitle someone to a paid plan.
 *
 * The second lock on the bug above, and the one that matters: mapStatus decides what we
 * *record*, this decides what we *grant*. Even if a future Dodo status slips through
 * unmapped, the plan is not written unless the subscription is genuinely live.
 */
const GRANTS_ACCESS: ReadonlySet<SubStatus> = new Set<SubStatus>(['ACTIVE', 'TRIALING'])

async function resolveUserId(
  userId?: string,
  clerkId?: string,
  dodoCustomerId?: string,
  email?: string,
): Promise<string | null> {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) return user.id
  }
  if (clerkId) {
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (user) return user.id
  }
  if (dodoCustomerId) {
    const sub = await prisma.subscription.findFirst({ where: { dodoCustomerId } })
    if (sub) return sub.userId
  }
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) return user.id
  }
  return null
}
