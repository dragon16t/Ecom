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
- Admin panel: catalog, banners, combos, coupons, niches (incl. per-device card
  images), employees, referrals, withdrawals, **subcategories**, live visitors
- Employee panel: orders, products, retention, AI Studio (with permission gates)
- MongoDB-backed sessions
- Pagination + server-side search storefront-wide
- Cloudinary-only image upload (no ephemeral disk writes)
- Email service with daily Gmail quota → SendGrid auto-failover at 250/day
- Admin Products list virtualization (handles 2,000-4,000 SKUs)

## Implemented (date log)
- 2026-02-01 — Admin Products virtualization (react-window).
- 2026-02-02 — Referral refresh, add-to-cart toast + bounce, cosmetics sort
  stable, employee /products route, white theme-color.
- 2026-02-03 — Shop-by-Category infrastructure: mandatory category, /admin/categories
  route, CategoryShowcase rich cards on /skincare + /cosmetics, AI auto-fill button
  next to Name, valid-HTML category cards.
- 2026-02-04 — Image-only category cards, AI fill returns mrp/offer_price/brand/
  size-with-fl-oz, URL scraper repaired (bs4+lxml).
- 2026-02-05 — Cosmetics concern drill-down, smoother search, live visitor tracking.
- 2026-02-05 — **Subcategories** end-to-end: new collection + GET/POST/PUT/DELETE
  admin endpoints, ProductInput.subcategory field, AdminConcerns 5th tab with
  parent-category filter, AdminProducts subcategory dropdown filtered by selected
  category, ConcernCategoryPage chip strip on category-mode pages. **Best Sellers
  / Luxury / Everyday seeded for all 16 cosmetic categories** (48 total). Empty
  chips render disabled with (0) count.
- 2026-02-05 — **Per-device niche card images** for the homepage 3-up:
  niche_settings.<slug>.card_image_{mobile, tablet, desktop, tv} with cascading
  fallback. Admin tab "Niche Card (3-up)" exposes 4 image inputs per niche.
  NicheCardSwitcher renders a <picture> element with media-query sources.
- 2026-02-05 — ConcernCategoryPage: removed emoji from H1, back-link branches by
  niche (cosmetics → /cosmetics, skincare → /skincare). SearchBar Enter key opens
  the first matching product directly; only falls back to /shop?q= when 0 matches.
  Tested 100% (Backend 48/48 + Frontend 11/11).

## Backlog (priority order)
- 🔴 P0 (user-verification pending): deployed employee login. User must
  redeploy + delete/recreate the affected employee in admin panel.
- 🟡 P1: Cloudinary plan / ImageKit migration before 2,000+ SKUs go live.
- 🟢 P2: Refactor `backend/server.py` (>3000 lines) into routes/orders.py etc.
- 🟢 P2: AI image generation button next to image uploader (Nano Banana) so
  product creation becomes "type name → AI Fill → AI Image → Save".
- 🟢 P2: Tag products with subcategories (admin data-entry — UI already ready).
- 🟢 P2: Add data-testids to ImageInput component for E2E testing of the niche
  card image admin uploads.

## Test credentials
See `/app/memory/test_credentials.md`.
