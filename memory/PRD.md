# Celesta Glow — PRD

## Original problem statement
Clone the "Celesta Glow" website with pixel-perfect React frontend + FastAPI/MongoDB backend. Has grown into a full DTC skincare e-commerce platform.

## Admin panel — `/admin/media-tools` (6 tabs)
1. **Certificates** — per-product lab report / test-report image (existing `TestReportEditor`)
2. **SEO Keywords** — per-product alt text + keyword injection
3. **Global Broadcast** — bulk SEO keyword broadcast
4. **Top Banner** (Feb-2026) — dedicated homepage top-strip image, desktop + mobile, click destination, active toggle
5. **Before / After** (Feb-2026) — CRUD for customer transformation images (global + per-product)
6. **Niche & Combo** (Feb-2026) — Anti-Aging Only ↔ Three Niche toggle + tiered combo bonus editor

## Recently delivered (Feb 2026 — combined summary)
- **Top Banner separate from niche hero** — new `GET|PUT /api/(admin/)top-banner` endpoints, new `TopBanner.js` component, new admin manager. No more text bleed between niche hero overlay and the top banner artwork.
- **Tiered Combo Bonus** — default 2 items → ₹99, 3 → ₹150, 4 → ₹200. Fully editable in admin (add / remove tiers, adjust items + amount). Server returns `combo_bonus_tiers`, `combo_bonus_next_tier`, `combo_bonus_aa_count`, `combo_bonus_message`, `combo_bonus_applied`.
- **Cart progress bar** — live gradient rail with 3 tier markers, unlocked pills, "add N more products to jump to ₹X OFF" nudge. Testids: `cart-combo-bonus-banner`, `cart-combo-progress`, `cart-combo-tier-{N}`.
- **Checkout Surprise Modal** — first-load gift-box reveal on `/checkout` announcing the ₹50 flash-timer discount. Wiggles → auto-reveals → confetti + "Claim my ₹50 OFF" CTA. Session-scoped so it only fires once.
- **Anti-Aging Only** niche mode default in production (~8k SKUs off the public API).
- **Before / After** carousel on Homepage (globals only) + PDP (product + globals), seeded with 5 uploaded transformation images.
- **DiscountPopup removed**, `/concern` + `/category` routes redirect to `/shop`.
- **Certificates** unchanged — served via `test_report_image` on `/api/products/{slug}`.

## Recently delivered (Feb-13-2026 batch)
- **Splash Screen no-flash fix** — `SplashScreen.js` now waits for `/api/site-settings` before rendering the image (opacity fade-in). Old bundled default no longer flashes before the admin-set splash. Cache-bust: `cg_splash_seen_v5`.
- **Order-placement latency** — email confirmation + Meta CAPI now fire-and-forget (`asyncio.create_task`). Batched N+1 product lookup in `create_order` stock validation + decrement. Measured latency: **130ms** (was 5-10s).
- **Scratch-to-reveal free gift** — `CheckoutSurpriseModal.js` new `ScratchCard` canvas overlay; user drags to reveal, fires `onReveal` at 45% erased. MRP prominently displayed (₹ worth + strikethrough MRP). 12s safety-net auto-reveal.
- **Pincode-based warehouse coverage** — new `GET /api/delivery/coverage-by-pincode?pincode=…` endpoint in `warehouses.py`. Resolves pincode → coords via Nominatim, does haversine against warehouses. `CheckoutPage.js` calls this on every pincode change and drives `pincodeInZone`; the COD gate now OR's it in so prepaid-only kicks in for out-of-zone non-house-brand carts.
- **Trend-Based Product Generator (Gemini)** — new admin tab at `/admin/trend-products`. Backend service `services/trend_product_generator.py` uses `emergentintegrations.LlmChat` with `gemini-2.5-flash`. Blueprint (name / description / keywords / gallery hints / FAQs / prices) + optional base_slug (clone images) → returns full listing with short_name, tagline, HTML description, 6 highlights, 12 keywords, per-image alt texts, FAQs, and 5 seed reviews. Products land `is_active=false`; admin toggles Publish. Endpoints: `POST /api/admin/trend-products/generate`, `POST /api/admin/trend-products`, `GET /api/admin/trend-products`, `PATCH /api/admin/trend-products/{slug}`. Budget-exceeded errors surface as 429 with `reason=llm_budget_exceeded` so the UI can prompt the admin to top up.
- **Product Image Gallery admin (SEO alt keywords)** — new admin tab at `/admin/image-gallery`. Search products, upload (multi), drag-reorder, tag each image with an alt keyword, remove, save. Endpoints: `GET|PUT|DELETE /api/admin/image-gallery{/products,/{slug}}`. Writes `image_gallery[]` on the product AND syncs the flat `images[]` mirror so legacy consumers keep working.
- **PDP secondary scroll gallery** — horizontal snap-scrolling gallery below Add-to-Cart on the product page, driven by `product.image_gallery` (falls back to `images[]`). Alt text renders under each thumbnail AND on the `<img alt>` for Google. `data-testid=pdp-scroll-gallery`.
- **House-only categories mode** — new `site_settings.house_categories_only` toggle. When ON, `/categories` hides the multi-brand niche cards / ribbon / ingredient strip and renders ONE hub of Celesta-Glow-branded products grouped by `category` (Serums, Sunscreens, etc.). Toggle lives in Admin Categories Hub above the hero editor. `data-testid=house-categories`.

## Known production issue
- ~~Last production deploy **failed**~~ **FIXED (Feb 13 2026)**: K8s readiness probe timing out because `services.taxonomy_canonical` was reclassifying 7 800+ products synchronously inside the `@app.on_event("startup")` block. `/health` was blocked for 8-10 min → pod killed before ready.
  - **Fix**: `server.py` startup now splits into two phases:
    1. Fast bootstrap (session hydration, admin pw cache, active-admin-hash, visitor indexes, Cloudinary env bootstrap, volume-discount migration) — completes in <1s.
    2. `_run_heavy_startup_tasks()` fires via `asyncio.create_task()` — product seed, migrations, concerns seed, catalog auto-restore, canonical taxonomy reset + reclassify 7 800 products, post-restore master-brain — all run AFTER `Application startup complete`.
  - Verified: `/api/health` responds in 6 ms after `supervisorctl restart backend`.
- Also cleaned up: duplicate `/api/pincode/{pincode}` route (kept the async httpx version in `api_router`, removed the blocking `requests` duplicate), duplicate `"60"` dict key in `PIN_PREFIX_STATE`, and three bare `except:` in `services/landing_page_service.py`.

## Key API endpoints (Feb-2026)
- `GET|PUT /api/top-banner` + `GET|PUT /api/admin/top-banner`
- `GET|PUT /api/admin/combo-bonus` (tiered)
- `GET /api/niche-mode` / `PUT /api/admin/niche-mode`
- `GET /api/before-after?only_global=true` / `GET /api/before-after/:slug`
- `POST|PUT|DELETE /api/admin/before-after(/:id)`
- `POST /api/cart/validate` returns `combo_bonus_tiers`, `combo_bonus_next_tier`, `combo_bonus_aa_count`, `checkout_bonus_applied`

## Pending / backlog (P1)
- IST fix for `today_blogs` / `today_views` counters in `server.py`
- Meta domain verification for celestaglow.com
- `server.py` modularisation (>3900 lines)


## Recently delivered (Feb 2026)
- **Global Niche Toggle** — `POST /api/admin/niche-mode` + public `GET /api/niche-mode`. Default = `["anti-aging"]`. When active_niches != all 3, `/api/products` and `/api/niches` hide skincare/cosmetics from the public API entirely (~8,000 SKUs off the wire). Admin/employee token bypasses filter. Cache 30s + 60s SWR.
- **NicheCardSwitcher hides itself** when only anti-aging is active (no more empty single-card row).
- **Concern & Category routes removed** — `/concern/:slug` + `/category/:slug` redirect to `/shop`.
- **DiscountPopup removed** — replaced by an inline ₹50 flash-timer discount message on the Checkout page.
- **Before / After feature** — extended `BeforeAfterImage` schema to support `is_global` + single stitched `image` field (client's format). New `BeforeAfterCarousel.js` component with auto-swipe + fade + dots. Rendered on Homepage (globals only) and on every PDP (product + globals). Full admin CRUD via a new "Before / After" tab under `/admin/media-tools`. Seeded with 5 customer transformation images uploaded by the client.
- **Cart Combo Bonus ₹99 OFF** — auto-applied when cart has ≥ 2 anti-aging products + subtotal ≥ ₹500. Admin-configurable via `GET|PUT /api/admin/combo-bonus`. Cart page shows a banner + nudge; total row shows dynamic amount.
- **Checkout Flash ₹50 OFF** — auto-applied on `/cart/validate` when prepaid + timer running + subtotal > ₹1000. Inline banner + dashed "add ₹X more to unlock" nudge shown on the Checkout page.
- **Admin Media Tools** now hosts 5 tabs: Test Reports, SEO Keywords, Global Broadcast, Before / After, Niche & Combo (niche toggle + combo bonus config).

## Pending / backlog (P1)
- Homepage niche banner refresh with new anti-aging-only artwork (user provided 5 B/A images for now; separate banner set is pending)
- Homepage speed audit after niche filter (Cloudinary widths, LCP preload, preconnect)
- IST fix for `today_blogs` / `today_views` counters in server.py
- Domain verification meta tag for celestaglow.com in Meta Business
- Aggregated Event Measurement priority setup in Meta

## Pending (P2 — future)
- Razorpay Payouts for automated referral withdrawal (blocked on user API key)
- Multi-warehouse inventory separation
- `server.py` modularisation (>3900 lines)

## Environment
- Preview: weather-preview-6.preview.emergentagent.com
- Production: celestaglow.com (needs manual redeploy per feature batch)
- Meta Pixel: 690863659974240

## Key API endpoints (Feb-2026 additions)
- `GET /api/niche-mode` — public read of active niches
- `PUT /api/admin/niche-mode` — admin flip Anti-Aging Only ⇄ Three Niche
- `GET /api/admin/combo-bonus` / `PUT /api/admin/combo-bonus` — admin combo discount config
- `GET|POST|PUT|DELETE /api/admin/before-after` — B/A CRUD (supports global + product-scoped)
- `GET /api/before-after?only_global=true` — homepage strip data
- `GET /api/before-after/:product_slug` — PDP strip (product + globals)
- `POST /api/cart/validate` now returns `combo_bonus_applied`, `checkout_bonus_applied`, `combo_bonus_amount`, `combo_bonus_message`


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
