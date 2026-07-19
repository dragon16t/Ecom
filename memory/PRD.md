# Celesta Glow — PRD

## Original problem statement
Clone the "Celesta Glow" website with pixel-perfect React frontend + FastAPI/MongoDB backend. Has grown into a full DTC skincare e-commerce platform.

## Current state (Feb 2026 preview)
Feature-rich shop app with Master Brain auto-categorisation, multi-warehouse instant delivery, ₹100 OFF prepaid promo, 10-min flash offer timer, anti-aging niche perks, Meta Pixel + CAPI, MS Clarity analytics, admin CRUD across 20+ areas, referral engine, influencer reels.

## Recently delivered (this session)
- **COD anti-aging fix** — `/api/cart/validate` now returns `niche`, checkout enables COD everywhere for anti-aging carts
- **Meta Pixel + CAPI v25.0** — server-side Purchase/Lead with event_id dedup; test code TEST21447 verified live
- **Business email fan-out** — `BUSINESS_EMAIL` accepts comma list; VeegalEnterprises@gmail.com receives every new order
- **₹100 OFF Prepaid button** — min cart ₹800, prepaid-only, server-enforced. Clean single-row card, 3 states.
- **10-min flash offer timer** — 2-day cooldown, animated banner, backend strips all perks on expiry (verified ₹914 → ₹1162)
- **Admin sidebar wiring** — added Warehouses, Delivery Men, Offers/COD/Sale, Alt-Text & SEO, Gift Cards, Influencer Reels
- **Cart/Checkout perf** — sessionStorage hydration, 250ms debounce on payment/bonus/promo changes
- **IST timezone fix** on `/api/admin/dashboard/summary` (preview only — needs prod deploy)
- **Live Visitors** product-name fetch bumped 200 → 1000
- **Influencer Reels** — new collection + full CRUD + auto-scrolling PDP carousel replacing the static dermatologist grid
- **Test report on PDP** — surfaces admin-uploaded certificates with lab + date
- **Global SEO broadcast** — Admin → Alt-Text & SEO → Global tab. Chip input + niche scoping + `$addToSet` merge
- **Manual referral link creation** — `POST /api/admin/referrals/create-manual` (backend only, UI pending)
- **Referrals pagination** — `page/limit/q` on `GET /api/admin/referrals`

## Pending / backlog (P1)
- Homepage + category image speed (Cloudinary widths, LCP preload, preconnect)
- AdminReferrals frontend button + form to consume the manual-create endpoint
- IST fix for `today_blogs` / `today_views` counters in server.py
- Domain verification meta tag for celestaglow.com in Meta Business
- Aggregated Event Measurement priority setup in Meta
- Server time indicator on admin dashboard header

## Pending (P2 — future)
- Razorpay Payouts for automated referral withdrawal (blocked on user API key)
- Multi-warehouse inventory separation
- `server.py` modularisation (>3800 lines)

## Environment
- Preview: cg3-render.preview.emergentagent.com
- Production: celestaglow.com (needs manual redeploy per feature batch)
- Meta Pixel: 690863659974240
- CAPI test code: TEST21447 (currently ACTIVE — clear when go-live is verified)

## Key API endpoints
- `POST /api/cart/validate` — accepts `prepaid_bonus`, `promo_active`, returns `niche` per item
- `POST /api/orders` — accepts `fbp`, `fbc`, `client_user_agent`, `prepaid_bonus`, `promo_active`
- `GET /api/reels/list?product_slug=X` — public reels
- `GET|POST|PUT|DELETE /api/admin/reels` — reel CRUD
- `POST /api/admin/seo-keywords/broadcast` — inject keywords into every product
- `POST /api/admin/referrals/create-manual` — manual referral link (name + phone)
- `GET /api/admin/referrals?page&limit&q` — paginated referral list
