# Celesta Glow — Product Requirements

## Original problem statement
Clone the "Celesta Glow" website and build a pixel-perfect, responsive frontend
plus a fully functional FastAPI + MongoDB backend with niche-based browsing,
cart, Razorpay checkout, Delhivery shipping, admin/employee panels, AI auto-fill,
and a referral system.

## Stack
- React (CRA) + TailwindCSS + Shadcn UI
- FastAPI (async) + Motor (MongoDB)
- Razorpay (checkout), Delhivery (shipping), Cloudinary (image hosting)
- SendGrid + Gmail SMTP (transactional email with auto-failover)
- Emergent LLM key (Claude Sonnet for AI auto-fill, Gemini Nano Banana for
  background removal)

## Core requirements (implemented)
- Niches: Anti-Aging / Skincare / Cosmetics
- Product detail with full content + AI-fillable fields
- Cart + Razorpay checkout with COD advance
- Customer Email-OTP login + referral dashboard
- Admin panel: catalog, banners, combos, coupons, niches, employees, referrals,
  withdrawals, **live visitors**
- Employee panel: orders, products, retention, AI Studio (with permission gates)
- MongoDB-backed sessions
- Pagination + server-side search storefront-wide
- Cloudinary-only image upload (no ephemeral disk writes)
- Email service with daily Gmail quota → SendGrid auto-failover at 250/day
- Admin Products list virtualization (handles 2,000-4,000 SKUs)

## Implemented (date log)
- 2026-02-01 — Admin Products virtualization (react-window).
- 2026-02-02 — Referral refresh (₹50, min ₹500, 7-day hold), add-to-cart toast
  + bounce, cosmetics sort stable, employee /products route, white theme-color.
- 2026-02-03 — Shop-by-Category infrastructure: mandatory category, /admin/categories
  route, CategoryShowcase rich preview cards on /skincare + /cosmetics with admin
  toggle/title controls, productImage util to resolve /api/uploads/* legacy paths,
  AI auto-fill button next to Name, valid-HTML category cards.
- 2026-02-04 — Image-only category cards (no emoji), 64px icon + tighter spacing,
  AI fill returns mrp/offer_price/brand/size-with-fl-oz, URL scraper repaired
  (added bs4 + lxml deps).
- 2026-02-05 — **Cosmetics concern drill-down** (4 seed concerns: Full Coverage,
  Everyday Natural, Bridal Glam, Long Wear) with new "Shop by Look" strip on
  /cosmetics, admin tabs split into Skincare/Cosmetic Concerns, ConcernCategoryPage
  back-link branches on niche.
- 2026-02-05 — **Smoother search**: dropdown shows up to 12 rich rows (image +
  tagline + ₹price + MRP strikethrough), no more "View all" navigation skeleton.
  Dedicated no-results state with "Browse all in Shop" CTA.
- 2026-02-05 — **Live visitor tracking** (option a): new `/api/visitor/ping`
  endpoint with 5-minute TTL Mongo collection, useVisitorPing hook fires on
  route-change + every 60s + visibilitychange (skips /admin and /employee).
  Admin /admin/live-visitors merges legacy in-memory analytics with new
  Mongo-backed pings. Backend 36/36 + Frontend 6/6 tests pass.

## Backlog (priority order)
- 🔴 P0 (user-verification pending): deployed employee login. User must
  redeploy + delete/recreate the affected employee in admin panel.
- 🟡 P1: Cloudinary plan / ImageKit migration before 2,000+ SKUs go live.
- 🟢 P2: Refactor `backend/server.py` (>3000 lines) into routes/orders.py etc.
- 🟢 P2: AI image generation button next to image uploader (Nano Banana) so
  product creation becomes "type name → AI Fill → AI Image → Save".
- 🟢 P2: Seed default `category_showcase_*` values into niche_settings so admin
  UI ships placeholder text on first install.

## Test credentials
See `/app/memory/test_credentials.md`.
