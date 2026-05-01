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
- Inline order tracking
- Admin panel: catalog, banners, combos, coupons, site settings, employees
- Employee panel: order management with permissions
- MongoDB-backed sessions (survive pod restarts)
- Pagination + server-side search across all storefront pages
- Cloudinary-only image upload (Cloudinary writes are mandatory; no local-disk
  fallback that vanishes on redeploy)
- Email service with daily Gmail quota tracking → SendGrid auto-failover at
  250 emails/day

## Implemented (date log)
- 2026-02-01 — Admin Products list virtualization (react-window v2). Threshold
  40 products: classic layout below, virtualized window with hint above. Edit
  card is hoisted above the virtual list to keep row heights uniform. Backend
  unpaginated cap raised from 500 → 5000 so admins can load 2,000–4,000 SKUs
  in one shot. Verified with 88 seeded products: only ~11 DOM rows materialised.

## Backlog (priority order)
- P1 — Cloudinary plan / ImageKit migration: warn / migrate before 25GB free
  bandwidth limit hits when 2,000+ SKUs × 4 images go live.
- P2 — Refactor `backend/server.py` (>3000 lines). Move order creation,
  checkout, and other legacy routes into `routes/orders.py` etc.
- P2 — Production employee-login fixes verified by user (handoff blocker).
  Recreate any employee created before the password-trim fix was deployed
  (their stored hash contains a stray space).

## Test credentials
See `/app/memory/test_credentials.md`.
