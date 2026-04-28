@"

\# SemanticToolz - Claude Code Context



\## Project Overview

AI-powered SaaS platform for content optimization. 15 tools across Free/Pro/Agency tiers.



\## Tech Stack

\- Frontend: Next.js 15.5.15, React, Tailwind CSS

\- Backend: Next.js API Routes, Prisma ORM

\- Database: PostgreSQL (Supabase)

\- AI: Anthropic Claude API

\- Auth: Clerk

\- Payments: Lemon Squeezy

\- Hosting: Vercel



\## Key Directories

\- src/app/ — Pages and API routes

\- src/lib/ — Utilities (lemonsqueezy.ts, prisma.ts, auth.ts, etc.)

\- prisma/ — Database schema

\- src/components/ — React components



\## Current Issue

LEMONSQUEEZY\_WEBHOOK\_SECRET is undefined at runtime in webhook handler, even though it's set in Vercel env vars and /api/debug confirms it exists.



\## Build Notes

\- Always redeploy WITHOUT cache for env var changes

\- Postinstall script forces Prisma generation

\- Webhook routes: /api/webhooks/lemonsqueezy

"@ | Out-File Claude.md

