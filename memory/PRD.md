# Celesta Glow — Product Requirements

## Original problem statement
Clone the "Celesta Glow" website from a provided preview link
(https://github.com/shadnazar/CGF.git). Build a pixel-perfect, responsive
frontend and implement a fully functional backend using FastAPI and MongoDB.
Include niche-based product browsing, cart, Razorpay checkout, Delhivery
shipping, and various admin management features.

## Stack
- React (CRA) + TailwindCSS + Shadcn UI
- FastAPI (async) + Motor (MongoDB)
- Razorpay (checkout), Delhivery (shipping), Cloudinary (image hosting)
- SendGrid + Gmail SMTP (transactional email with auto-failover)
- Emergent LLM key (Claude Sonnet for AI auto-fill, Gemini Nano Banana for
  image background removal)

## Core requirements (implemented)
- Niche browsing: Anti-Aging / Skincare / Cosmetics
- Product detail page with full content (ingredients, benefits, FAQs, how-to-use)
- Cart + Razorpay checkout with COD advance support
- Customer Email-OTP login (no password)
- Inline order tracking + referral dashboard (see below)
- Admin panel: catalog, banners, combos, coupons, site settings, employees,
  referrals + withdrawal queue
- Employee panel: order management with permissions (Products, Retention,
  AI Studio routes now live)
- MongoDB-backed sessions (survive pod restarts)
- Pagination + server-side search across all storefront pages
- Cloudinary-only image upload (Cloudinary writes are mandatory; no local-disk
  fallback that vanishes on redeploy)
- Email service with daily Gmail quota tracking → SendGrid auto-failover at
  250 emails/day
- Admin Products list virtualization (react-window) — threshold 40, handles
  2,000–4,000 SKUs smoothly

## Implemented (date log)
- 2026-02-01 — Admin Products list virtualization (react-window v2). Backend
  unpaginated cap raised from 500 → 5000.
- 2026-02-02 — Referral system refresh: ₹50 cashback (was ₹100), min order
  ₹500 enforced, 7-day return window hold before cashback is withdrawable,
  customer `/account` referral widget, admin `/admin/referrals` withdrawal
  queue with Mark Paid / Reject flow, WELCOME50 coupon auto-applies for
  `?ref=...` visitors. Tested end-to-end (13/13 backend tests).
- 2026-02-02 — Add-to-cart micro-interaction: green "Added to bag" toast +
  cart-icon bounce + pop animation on count badge. Cosmetics sort stabilised
  with (sort_order, slug) tie-break. Employee `/employee/products` route
  wired (was "Under Construction"). Theme-color `#16a34a` → `#ffffff`.
  WhatsApp button nudged up with safe-area insets to avoid overlap.
- 2026-02-03 — Shop-by-Category infrastructure:
  • Fixed admin categories filter (was using wrong field `group`; now uses
    `niche`). 31 categories now visible (15 skincare + 16 cosmetics).
  • Category is now MANDATORY on product create (422 from backend, red-border
    select + alert on frontend).
  • `/admin/categories` route added (alias to AdminConcerns with Skincare tab
    pre-selected).
  • New <CategoryShowcase> rich preview section on /skincare + /cosmetics
    showing each category with up to 4 product previews.
  • Admin controls (toggle + eyebrow/heading/highlight text) added to the
    Niche Customization → Sections/Visibility tab for both niches.
  • Images: new utils/productImage.js resolves legacy `/api/uploads/...`
    relative paths + Cloudinary absolute URLs. Used consistently across
    SearchBar, ConcernCategoryPage, AdminProducts, CategoryShowcase.
  • AI Auto-Fill button next to product Name input in the Create flow —
    uses existing POST /api/admin/ai/generate-product-content.
  • Valid HTML: outer category card is now a `<div role="link">`, inner
    product chips are `<button>` — no more nested anchors.
  • Tested 100% pass (backend 17/17 + frontend 4/4).

## Backlog (priority order)
- P1 — Cloudinary plan / ImageKit migration: warn / migrate before 25GB free
  bandwidth limit hits when 2,000+ SKUs × 4 images go live.
- P2 — Add `data-testid` to create-flow tagline/description/size/ingredients
  fields for better automated coverage (agent action item from iteration_3).
- P2 — Seed default `category_showcase_*` values into niche_settings so admin
  UI shows "Shop by Category / Find what you're looking for / looking for"
  placeholders explicitly.
- P2 — Refactor `backend/server.py` (>3000 lines). Move order creation,
  checkout, and other legacy routes into `routes/orders.py` etc.
- P2 — Production employee-login fixes verified by user (handoff blocker).
  Recreate any employee created before the password-trim fix was deployed.

## Test credentials
See `/app/memory/test_credentials.md`.
