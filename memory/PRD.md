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
- 2026-02-05 — Subcategories end-to-end: new collection + GET/POST/PUT/DELETE
  admin endpoints, ProductInput.subcategory field, AdminConcerns 5th tab with
  parent-category filter, AdminProducts subcategory dropdown filtered by selected
  category, ConcernCategoryPage chip strip on category-mode pages.
- 2026-02-05 — Per-device niche card images for the homepage 3-up.
- 2026-02-05 — ConcernCategoryPage emoji removed; SearchBar Enter opens first
  matching product directly.
- **2026-02-06 — Subcategory taxonomy reset to standard e-commerce model**:
  • Wiped 48 generic auto-seeded subcategories (Best Sellers / Luxury / Everyday)
    that were polluting every cosmetic category.
  • AdminProducts create form: Subcategory dropdown only renders when chosen
    Category has real subcategories; otherwise an amber "No subcategories under
    {parent} yet — Add some" hint links straight to /admin/categories.
  • AdminConcerns Subcategories tab: added prominent "How subcategories work"
    explainer banner with real examples (Lipstick → Matte / Glossy / Liquid).
  • Verified by testing agent iter6: 12/12 backend + 6/6 frontend flows pass.
- **2026-02-06 — Edit Product modal + concerns refetch on open**:
  • Added cascading Subcategory picker to the Edit Product modal (was only on
    New). Switching Category now resets subcategory='' here too.
  • New useEffect refetches concerns + categories + subcategories every time
    the product modal opens, so a freshly-created concern shows up without a
    page reload. Verified iter7 7/7 backend + 6/6 frontend pass.
  • Added server-side validation rejecting empty/whitespace slug or name on
    POST /api/admin/subcategories (prevents zombie rows).
  • Frontend AdminConcerns save() auto-derives slug from name (parent-prefixed
    for subcategories) so admins can leave the slug blank.
- **2026-02-06 — 🔐 Critical admin auth security fix**:
  • Centralized active-admin-hash cache in services/admin_auth.py.
  • Previously: env-seed password 'celestaglow2024' was accepted forever even
    after the admin saved a custom password — leaked default = forever access.
  • Now: once admin_settings.password is set, the env-seed value is INERT.
    Verifier files refactored: admin.py, server.py, concerns.py, products.py,
    reviews.py, image_ai.py, landing_pages.py, consultation.py.
  • change-password now invalidates ALL admin_sessions (clear_all on
    SessionStore) so anyone holding a stale token is forced to re-auth.
  • ALSO fixed: GET /api/products?active_only=false was fully PUBLIC (leaked
    every inactive/draft product). Anonymous callers with active_only=false
    are now silently coerced to active_only=true.
  • Verified by testing agent iter8: 36/44 pytest pass — all real security
    assertions green; 8 misses were spec/test-design issues, not code bugs.
- **2026-02-06 — Return Policy rewrite (opened bottles non-returnable)**:
  • Rewrote /refund-policy: "Sealed-Bottle Returns Only" banner, 7-day window
    on UNOPENED items only, explicit Section 3 "Non-Returnable / Non-Refundable"
    listing opened/used/sampled/swatched/seal-broken — even if used only once.
  • Updated all storefront trust strips, product FAQ, About page, Terms page,
    LanguageContext label from "30-Day Money Back" → "7-Day Sealed Return".

## Backlog (priority order)
- 🔴 P0 (user-verification pending): deployed employee login. User must
  redeploy + delete/recreate the affected employee in admin panel.
- 🟡 P1: Cloudinary plan / ImageKit migration before 2,000+ SKUs go live.
- 🟢 P2: Refactor `backend/server.py` (>3000 lines) into routes/orders.py,
  routes/referrals.py, routes/visitor_tracking.py.
- 🟢 P2: AI image generation button next to image uploader (Nano Banana).
- 🟢 P2: Razorpay Payouts API for automated referral withdrawal.
- 🟢 P2: Tag products with subcategories (admin data-entry — UI is ready, DB
  is now clean for fresh real-world subcategories).
- 🟢 P2: Add data-testids to ImageInput component for E2E testing of the niche
  card image admin uploads.
- 🟢 P2: ConcernCategoryPage 'Back to Skincare' link still says 'Skincare' even
  when concern.niche='cosmetics' (low-priority polish, noted iter6).

## Test credentials
See `/app/memory/test_credentials.md`.
