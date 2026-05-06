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
