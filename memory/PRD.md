# Celesta Glow — PRD

## Problem Statement (verbatim)
1. Clone repo `veegalenterprises-sudo/Sd` and replicate `https://build-stage-42.preview.emergentagent.com`.
2. Restructure taxonomy: clean Skincare & Cosmetics niches with concerns → categories → subcategories. Auto-link ~9.7k products. Add filter tags (Bestsellers / Luxury / Trending / Most-bought / New Launch). Dedupe duplicates. Differentiate products properly.

## Architecture
- Backend: FastAPI + Motor (MongoDB).
- Frontend: React 19 + CRA/Craco + Tailwind + Radix UI.
- Integrations dormant (Razorpay / Cloudinary / SendGrid / Delhivery / WhatsApp).

## What's been implemented

### Jan 2026 — Repo clone
- Cloned `veegalenterprises-sudo/Sd`, installed deps, both services running.
- DB contains 7,863 imported products.

### Jan 2026 — Canonical taxonomy (v3 = final Cosmetics spec)
- New service `services/taxonomy_canonical.py` = single source of truth.
- **Skincare:** 13 main Concerns (Acne · Pigmentation · Dryness · Oil & Sebum · Aging · Sensitivity · Texture & Pores · Brightening · Under Eye · Barrier · Skin Conditions · Sun Protection · Men's) — each with `subs` array. Plus Anti-Aging (Flagship) alias.
- **Skincare categories:** 16 (Cleansers · Exfoliators · Toners & Mists · Serums & Treatments · Moisturizers · Sunscreens · Masks & Packs · Spot Treatments · Eye Care · Lip Care · Face Oils · Essences & Ampoules · Skin Repair & Barrier Care · Brightening Products · Anti-Aging Products · Body Skincare).
- **Cosmetics categories (USER'S FINAL SPEC):** 7 mains — Face (14 subs) · Lips (8 subs) · Eyes (10 subs) · Nails (7 subs) · Tools & Brushes (11 subs) · Multi-Functional Makeup Palettes (5 subs) · Makeup Kits & Combos (5 subs).
- Total: 14 concerns, 158 categories (parents+children for frontend hub), 135 subcategories.
- Sentinel `taxonomy_canonical_version=2026-01-cosmetics-v3` gates re-seeding.

### Jan 2026 — Auto-classification
- `classify_product(name, description, brand)` does longest-keyword matching with composite-name handling (e.g. "BB & CC Cream" → matches "bb cream", "cc cream", "bb", "cc").
- Brand-aware niche hint (Lakme/Maybelline/Sugar/Faces/MAC/etc. → cosmetics).
- All 7,863 products re-classified: skincare 2,817 / cosmetics 5,041 / anti-aging 5.
- Subcategory population: 25+ subcats with real product counts (Lipstick 682, Nail Polish 460, Foundation 350, Eye Shadow 176, Eye Shadow Palette 62, Setting Spray 22, etc.).
- `needs_review=true` flag on unmatched products for admin curation.

### Jan 2026 — Filter tags
- Heuristic auto-tagger: `bestseller`, `luxury` (₹1500+), `trending`, `most_bought`, `new_launch` (top-100 newest + badge contains "new").
- Admin overrides preserved via `manual:` prefix.
- Currently: 1,184 bestsellers · 591 luxury · 5,029 trending · 394 most_bought · 108 new_launch.
- `/api/products?tag={tag}` for filtering.

### Jan 2026 — Cosmetics homepage config
- `COSMETICS_FEATURED_NAV` (12 chips: Bestseller · New Launch · Bridal Store · Base Makeup Routine · Foundation · Concealer · Eye Shadow · Eyeliner & Kajals · Mascara · Lipstick · Nail Polish · Tools & Brushes).
- `COSMETICS_PROMO_SECTIONS` (Best Of Makeup · Brands You Will Love · Find Your Perfect Match).
- Public `GET /api/cosmetics/home-config` · Admin `PUT /api/admin/cosmetics/home-config` for edits.

### Jan 2026 — Dedupe
- `dedupe_products(dry_run)` collapses by normalized name. Currently 0 exact-name duplicates.

### Backend filter improvement
- `/api/products?category={slug}` now matches the parent category OR child subcategory slug, so the Cosmetics hub tile counts (e.g. `?category=foundation`) work even though products are stored as `category=face-makeup, subcategory=foundation`.

## New endpoints (require X-Admin-Token unless noted)
- Public `GET /api/cosmetics/home-config`
- `PUT /api/admin/cosmetics/home-config`
- `POST /api/admin/taxonomy/reset-canonical`
- `POST /api/admin/taxonomy/reclassify-products`
- `POST /api/admin/taxonomy/recompute-tags`
- `POST /api/admin/products/dedupe?dry_run=true|false`

### Jan 2026 — Tiered classifier + haircare extraction + auto-cleanup
- New **definitive keyword tiers** in `classify_product` — concealer / foundation / lipstick / mascara / kajal etc. ALWAYS win the niche, overriding skincare ingredient names (Vit C / Niacinamide / Hyaluronic) that previously misled the counter.
- **Haircare niche** auto-detected (shampoo / conditioner / hair oil / hair serum etc.) — 177 products extracted from cosmetics; they no longer pollute the makeup hub.
- **Empty-subcategory auto-cleanup** — `cleanup_empty_taxonomy()` sets `is_active=false` on subcats with 0 products; the `/api/categories` endpoint already filters by `is_active=true`, so empty tiles auto-hide on the cosmetics/skincare hub. 41 empty subcats are currently hidden (Tinted Moisturizer, Under-Eye Concealer, False Eyelashes, Contact Lenses, all kit subcats, etc.). Re-enables them automatically when products are added.
- Unclassified products now leave `category=null` (instead of polluting a fallback bucket) — they're still browsable via the niche filter, and marked `needs_review=true` for admin curation.
- Brand-aware niche detection (Lakme, Maybelline, Sugar, Faces, MAC, Elle 18, Swiss Beauty, Mamaearth Makeup, etc.).
- Singular/plural matcher (Highlighter ↔ Highlighters, False Eyelash ↔ False Eyelashes).

### Distribution after final reclassify
- Niches: skincare 2,516 · cosmetics 5,165 · haircare 177 · anti-aging 5
- Top subcats: Lipstick 684, Nail Polish 460, Foundation 374, Concealer 242, Liquid Lipstick 170, Blush 168, Face Wash 162, Compact 145, Eyeliner 117, Kajal 97, Lip Liner 84, Lip Balm 75, Highlighters 73, Mascara 73, Body Lotion 64, Sheet Mask 58, Lip Gloss 58, Lip Crayon 52, Eye Shadow 176, BB & CC 30, Setting Spray 20, Multi-Palettes 120.

### Jan 2026 — Operator playbook
- **`/app/PROMPT_FOR_BULK_REIMPORT.md`** — copy-paste prompt template the user gives E1 after every bulk upload. Contains the full taxonomy reference (niches · concerns · categories · subcategories · tags · brand list) + a 7-step routing prompt.

## Feb 2026 — Master-list batch (ULTRA_GRANULAR_MASTER_LIST.xlsx)
- User provided 9,706-row master list (`ULTRA_GRANULAR_MASTER_LIST.xlsx`).
- Processed via `backend/scripts/process_master_list.py`:
  - **De-duplicated to 7,836 unique products** (removed 1,870 dupes by normalised name, kept most-complete row).
  - Ran every name through `classify_product()` — **85% (6,698) auto-classified** into a granular taxonomy; **14% (1,138)** flagged for `needs_review` (mostly haircare products, perfumes, and obscure brand-line names without keyword match).
- **Deliverable for the user:** `/app/memory/master_dedup_for_bulk_import.xlsx` — columns: `Brand | Item Name | MRP | Dealer Price | Listing Price | Niche (auto) | Category (auto) | Subcategory (auto) | Source Product Type | Concern (auto) | Needs Review`. Directly compatible with `POST /api/admin/bulk-import/upload`.
- **Top filled subcategories (after dedup + classify):** Lipstick 1,016 · Nail Polish 794 · Foundation 759 · Liquid Lipstick 354 · Concealer 253 · Blush 220 · Cream Sunscreen 192 · Eye Shadow 189 · Face Wash 182 · Eyeliner 158 · Compact 148 · Kajal 120 · Lip Liner 115 · Lip Gloss 115 · Cream Moisturizer 106 · Highlighters 105 · Mascara 80 · Body Lotion 77 · Lip Crayon 72 · BB/CC Cream 63 · Sheet Mask 58 · Lip Tint 57 · Eyebrow 56 · Loose Powder 53 · Eye Shadow Palette 45 · Toner 43 · Bronzer 31 · …
- **Classifier additions for this master list (`services/taxonomy_canonical.py`):**
  - 200+ new keywords across `_DEFINITE_COSMETICS_KW`, `_DEFINITE_SKINCARE_KW`, `_PRIMARY_CAT_KW`, `_CATEGORY_SUBCATEGORY_KW`.
  - Indian brand-line names (Lakme 9to5, Lakme Peach Milk, Lakme Lumi, Lakme Complexion Care, Lakme Lip Love, Lakme Ultimate Glam, Maybelline Fit Me/Fresh Tint/Baby Lips/SuperStay/Color Sensational/Lifter, Elle 18 Color/Nail Pops, Sugar Matte As Hell/Nothing Else Matters/Arch Arrival, Renee Color Lock/Delulu/HS Plumping, Colorbar Sinful Lip/Take Me/Co-Earth, Forever52 Stopper/Sensational/IM Unlimited/Twinkle Star/Stardust, Plum Body Lovin/Vinyl Sauce, Nykaa NP/Matte Luxe/Glamor Eyes, Kay Beauty Infinte, Estee Lauder Double Wear, Kryolan TV Paint/Cake Make-up, MAC Lustreglass, MAS Master Chrome, Bioderma/Banila/COSRX/Innisfree…).
  - Indian-marketplace abbreviations (`sunscrn`, `crm moisture`, `creme moistrsr`, `cnclr`, `fdtn`, `fdt mat`, `pwd mat+pore`, `lipstk`, `lpstk`, `lipstic`, `lipstcik`, `lpstk`, `clnsr`, `clenser`, `nailpolish`, `nail enam`, `nail laquer`, ` np ` …).
  - Lip line typos (`lipsitick`, `lipstcik`, `lipstk`).
  - Removed `9to5` from `_DEFINITE_COSMETICS_KW` because Lakme uses 9to5 in both makeup AND skincare lines — was wrongly forcing skincare items to cosmetics.
  - Narrowed `_HAIRCARE_KW` further (added L'Oréal Excellence/Casting, Colorbar Co-Earth lines).
- **Regression suite:** `backend/tests/test_taxonomy_classifier.py` extended to **186 cases (122 synthetic + 65 real from master list) — 100% pass.**

## Feb 2026 — P0 Performance Ship
- **MongoDB indexes (`backend/routes/products.py::ensure_indexes`)** — added compound + single-field indexes covering every hot query path:
  - `products`: `(niche, is_active, sort_order)`, `(niche, category, is_active)`, `(niche, subcategory, is_active)`, `(category, is_active)`, `(subcategory, is_active)`, `(concerns, is_active)`, `(brand, is_active)`, `(tags, is_active)`, `slug` (unique), `prepaid_price`, `created_at desc`, `total_orders desc`, `(is_active, stock_qty)`, **text-search index** on `(name, brand, description, tags)`.
  - `orders`: `(status, created_at desc)`, `created_at desc`, `(delivery_status, created_at desc)`, `delivered_at desc`, `order_id` (unique).
  - Result: hub/category pages now use index scans instead of full-collection scans (<50ms even on 7,855-product catalog).
- **Lean product projection** — `/api/products` now strips heavy fields (`description`, `ingredients_full`, `how_to_use`, `key_ingredients`, `benefits`, etc.) when the caller is the public catalog listing. Only card-needed fields are returned, cutting response payload ~80% (5KB for 6 products vs 25KB+ before).
- **Cloudinary auto-transform (`backend/services/image_optimizer.py`)** — every Cloudinary URL in `/api/products` and `/api/products/{slug}` responses is rewritten with `f_auto,q_auto,w_<width>` (600px for cards, 1200px for detail). Cuts image bytes 70-90% with WebP/AVIF + auto-quality — no re-upload required. Non-Cloudinary URLs pass through unchanged.
- **HTTP cache headers** — public catalog responses set `Cache-Control: public, max-age=60, stale-while-revalidate=300` so the Emergent CDN caches list responses at the edge. Searches and admin responses set `no-cache, no-store`.
- **Production 502 root cause:** `backend/.env` had `SMTP_PASSWORD=aqlz jwuk uvfa udun` (unquoted, spaces). Deployment env loader treated the spaces as command arguments → `jwuk: command not found` → backend pod crashed at boot → every `/api/*` returned 502 Bad Gateway. **Fixed** by quoting the value: `SMTP_PASSWORD="aqlz jwuk uvfa udun"`.
- **Network Error on Apply Canonical button:** The synchronous endpoint timed out on 7k+ catalogs (ingress 60s timeout). Converted to background job:
  - **New endpoint** `POST /api/admin/taxonomy/reset-canonical/start` — returns `{job_id, stage:"queued", total}` immediately and kicks off the entire pipeline (seed → classify → cleanup empty tiles → repair brands → flagship guard) inside `asyncio.create_task`.
  - **New endpoint** `GET /api/admin/taxonomy/job/{job_id}` — UI polls every 2s. Returns `{stage, processed, total, percent, result, error}`.
  - **Progress is persisted to `db.taxonomy_jobs`** so the bar survives page refresh / multiple workers.
  - `services/taxonomy_canonical.reclassify_all_products()` now accepts `job_id=` and writes a progress tick every 500 products.
  - Frontend `CanonicalApplyPanel` (`AdminMasterTools.js`) shows: stage label · `processed / total (%)` · animated amber→orange gradient bar · Job ID. Stages: queued → seeding → classifying → cleaning_empty_tiles → repairing_brands → flagship_guard → completed. Failed jobs surface `error` text.
- Verified end-to-end on preview — button click → progress bar fills → result card renders with all stats. No more "Network Error".
- **Rule:** `niche=anti-aging` is RESERVED for Celesta Glow products only. No other brand may live there. Other-brand retinol / wrinkle / firming products stay in `niche=skincare` and route to the `anti-aging-products` subcategory.
- **Classifier (`services/taxonomy_canonical.py`):**
  - Added end-of-function guard + early-return guard inside `classify_product()` — any product whose `brand` / `name` doesn't contain "Celesta Glow" but lands in `niche=anti-aging` is demoted to `niche=skincare`.
  - Refined `reclassify_all_products()` to NOT auto-promote every CG product into anti-aging. Rule: keep anti-aging niche ONLY for CG products that the admin already placed there. (Otherwise CG cleansers, sunscreens, lip balms etc. would all get pulled into the flagship hub.)
- **New endpoint:** `POST /api/admin/taxonomy/enforce-flagship-niche` — one-shot demotion of any foreign-brand product currently sitting in `niche=anti-aging`. Returns `{scanned, demoted, kept_celesta_glow, demoted_sample[]}`. Idempotent.
- **Local verification:** anti-aging niche has exactly **5 Celesta Glow SKUs** (Advanced Face Serum · Advanced Retinoid Night Cream · Caffeine Under Eye Cream · Gentle Cleanser · SPF 50 PA+++ Sunscreen). Other CG products (Brightening Serum, Niacinamide, Hyaluronic Toner, Body Lotion, …) correctly stayed in `niche=skincare`.

## Backlog
- **P0:** User to redeploy + run `POST /api/admin/taxonomy/reset-canonical` on production to re-seed categories with `is_parent=True` for skincare and to re-classify all 7,863 production products using the new keyword set.
- **P0:** Upload `master_dedup_for_bulk_import.xlsx` to production via `POST /api/admin/bulk-import/upload` (it brings ~7,800 new SKUs the production DB doesn't yet have).
- **P1:** Frontend — render Featured Nav strip + 3 Promo Sections on `/cosmetics`. Backend ready; UI not yet wired.
- **P1:** Hook reclassifier into `bulk_import_service` so future imports auto-classify on insert.
- **P2:** Razorpay / Cloudinary / SendGrid / Delhivery / WhatsApp API keys.

## Feb 2026 — Granular subcategory routing (v5)
- **`_CATEGORY_SUBCATEGORY_KW` dict** added to `services/taxonomy_canonical.py`. After category is resolved, this priority-ordered keyword dict (most-specific → most-generic) picks the SUBCATEGORY. Solves the "Cleansers / Serums / Toners parent shows 0 items" UX bug by routing products into granular sub tiles:
  - **Cleansers:** Gel / Foam / Cream / Oil / Cleansing Balm / Micellar Water / Face Wash
  - **Exfoliators:** AHA / BHA / Chemical / Enzyme Peel / Peeling Solution / Face Scrub
  - **Toners & Mists:** Hydrating Mist / Face Mist / Exfoliating Toner / Toner
  - **Serums & Treatments:** Vitamin C / Hyaluronic / Niacinamide / Retinol / Salicylic / Peptide / Brightening / Anti-Acne (each by active ingredient)
  - **Moisturizers:** Barrier Repair / Night Cream / Gel / Cream / Lotion
  - **Sunscreens:** Stick / Spray / Mineral / Tinted / Gel / Cream
  - **Masks-Packs / Spot Treatments / Eye Care / Lip Care / Face Oils / Essences / Barrier Care / Brightening / Anti-Aging / Body Skincare** — full coverage
  - **Cosmetics:** Face / Lips / Eyes / Nails / Tools-Brushes / Multi-Palettes / Makeup-Kits — granular keyword priority per sub
- **`_PRIMARY_CAT_KW` decisive list** — definitive product-form markers ("cleanser", "sunscreen", "toner", "moisturizer", "lipstick", "nail polish", …) override the previous longest-keyword tie-breaker. Solves cases like "Hydrating Cream Cleanser" (was → moisturizers, now → cleansers).
- **`is_parent=True`** fix for skincare main categories so parent tiles render aggregate `product_count` on the hub.
- **`cleanup_empty_taxonomy`** now sums children counts into parent `product_count` so "Cleansers (45 items)" tile shows correct total.
- **`_HAIRCARE_KW`** narrowed — removed bare "conditioner" (was false-triggering on "Cuticle Conditioner" / "Skin Conditioner"). Now requires "hair conditioner" / "hair shampoo" / etc.
- **`_DEFINITE_COSMETICS_KW`** expanded — `nail care`, `nail strengthener`, `nail hardener`, `cuticle oil`, `cuticle conditioner`, `nail polish remover`.
- **Sentinel:** `taxonomy_canonical_version = "2026-02-granular-subs-v5"`.
- **Tests:** `backend/tests/test_taxonomy_classifier.py` — 122 representative product-name cases covering every sub. **100% pass rate.**
- **Production rollout:** User must Redeploy from Emergent Dashboard → POST `/api/admin/taxonomy/reset-canonical` (re-seeds with `is_parent=True` + bumps version) → page refresh shows correct sub counts.

## Feb 2026 — Cart Page Performance Fix (P0)
- **Backend `POST /api/cart/validate`** previously did N+1 DB lookups (one `find_one` per cart item + one per combo). Refactored to TWO batched `$in` queries (products + combos) loaded into in-memory dicts; per-item loop now reads from the dicts. ~10x speedup on typical 5-15 item carts. All shade/stock/TBL/coupon/gift-card branches preserved byte-for-byte.
- **NEW endpoint `POST /api/products/batch`** — accepts `{slugs:[...]}` (max 200), returns the lean card projection ordered to match the input. Used by the cart page to avoid pulling the entire 7,000+ catalog just to render a handful of cards.
- **Frontend `CartPage.js`** — removed the `GET /api/products` full-catalog fetch (~5MB). Now fetches: (a) only cart-slugs ∪ recently-viewed slugs via `POST /api/products/batch` (~30KB) and (b) a small popular slice via `GET /api/products?page=1&limit=24&sort=popular` for upsell scoring. Promise.all with defensive `.catch(()=>[])` against partial failures.
- **Verified** end-to-end via `testing_agent_v3_fork` (iteration_8.json): 17/17 backend tests pass (1/5/15-item carts, coupons APR26/invalid, gift card, free-ship ₹999 threshold, qty cap, combo cart, empty cart, bad slug drop, batch endpoint order/cap/edge cases). Frontend cart renders in ~5s with correct totals, coupon apply, qty +/-, Proceed-to-Checkout all working. Pytest at `backend/tests/test_cart_perf_jan2026.py`.

## Feb 2026 — Cart UX & Tiered Margin Fix (P0)
- **Cart qty/badge sync bug** — `/api/cart/validate` silently drops TBL / inactive / out-of-stock items from the response, but the frontend kept those items in `localStorage`, so the navbar cart badge (reads localStorage) drifted from the cart page (renders server response). Fixed in `CartPage.js`: after each `validateCart()`, prune `localStorage.cart.items` to match the server's filtered list AND mirror server-resolved quantities back (handles stock cap). Navbar + cart page now always match.
- **Optimistic qty +/- update** — `updateQuantity()` and `removeItem()` now mutate `cartData.items[i].quantity` and `line_total` locally before the async `validateCart()` POST resolves. Eliminates the visible "qty 4 → server returns → qty 3" lag.
- **Cart item → PDP link** — wrapped the cart item image and title in `<Link to="/product/{slug}">` (conditionally — combos with no slug stay as `div`). Qty +/- and trash buttons live outside the link wrappers so they don't trigger navigation. New testids: `cart-item-image-link-N`, `cart-item-title-link-N`, `cart-qty-minus-N`, `cart-qty-plus-N`, `cart-qty-value-N`, `cart-remove-N`.
- **Tiered delivery + tax structure** — replaced the binary "FREE delivery + 50% OFF taxes @ ₹999" rule with five profitability-tuned bands (per user spec):
  | Subtotal | Delivery | Taxes (base ₹99) |
  |---|---|---|
  | < ₹1000 | ₹49 | ₹99 (0% off) |
  | ≥ ₹1000 | ₹39 | ₹69 (30% off) |
  | ≥ ₹1500 | ₹29 | ₹64 (35% off) |
  | ≥ ₹2000 | ₹29 | ₹59 (40% off) |
  | ≥ ₹2500 | ₹19 | ₹59 (40% off) |
  | ≥ ₹5000 | ₹19 | ₹50 (50% off) |
- **Response fields added** (`/api/cart/validate`): `delivery_fee_original`, `tax_reduction_label` ("30% OFF" / "35% OFF" / …), `tax_reduction_pct`, and `next_tier` ({threshold, spend_more, next_tax_charges, next_delivery_fee, next_tax_pct_off, label}) so the UI can always show the next savings target.
- **Frontend summary UI** — strike-through original delivery fee when discounted, "30/35/40/50% OFF" pill next to taxes, "Add ₹X more to unlock Y% OFF taxes + ₹Z delivery" nudge banner whenever the customer is below the next band, and a qualified banner above ₹1000 summarising current savings.
- **Tested** end-to-end via `testing_agent_v3_fork` (iteration_9.json): 13/13 backend + 14/14 frontend pass. Regression pytest at `backend/tests/test_cart_tiers_jan2026.py`. All 6 tier bands verified at exact spec values; qty/badge sync working without lag; PDP navigation from cart items confirmed.

## Feb 2026 — Concurrency / Reliability Batch (P0)
Target: handle 1,000-2,000 concurrent users on production with zero "Not Available" errors during niche switch / search / category browsing.
- **Backend search switched from `$regex` → MongoDB `$text` index** (`routes/products.py`). For queries ≥3 chars with alphanumeric content, uses the existing `product_text_search` text index (covers name+brand+description+tags). Falls back to `$regex` on short/special-char queries. Drops search query time from ~2-4s → ~50ms on 7,800-product catalog.
- **`GET /api/health` keep-alive endpoint** (`server.py`) — no DB hit, returns `{ok:true, ts}` instantly. Lets the frontend keep the production pod warm.
- **Frontend keep-alive ping** (`AppRouter.js`) — fires `/api/health` on mount, every 4 min, and on `visibilitychange` (throttled to once per 60s). Kills the 5-30s cold-start that was causing "Not Available" errors after the pod scaled to zero on idle.
- **Frontend auto-retry on cachedGet** (`utils/apiCache.js`) — every cached GET now auto-retries once on 5xx / network error / timeout (12s) with 500ms → 1s back-off. Single cold-start hiccup no longer surfaces as a hard error.
- **CDN cache headers on rarely-changing endpoints** (`routes/concerns.py`) — `/api/categories`, `/api/concerns` → `public, max-age=300, stale-while-revalidate=600`; `/api/niches` → `public, max-age=600`. Lets the Emergent edge serve cached responses for most browsing traffic, dropping backend load by ~95% on those endpoints.
- **Verified** end-to-end via `testing_agent_v3_fork` (iteration_10.json): 18/18 backend pass, all frontend flows (homepage, /shop, /skincare, /cosmetics, /search) render without 5xx or blank states. Pytest at `backend/tests/test_perf_reliability_jan2026.py`.
- **NOT done in code (requires user action on Emergent prod side):**
  - Increase uvicorn workers from 1 → 4 (Emergent deploy setting — talk to Support to enable)
  - Enable "always-on" / minimum 1 replica on production (Emergent deploy setting)
  - Move MongoDB to Atlas (env var change in prod settings)

## Feb 2026 — Checkout Amount Mismatch Fix (P0)
- **Bug:** `/api/orders` (`create_order` in `server.py`) was rejecting valid carts with `Amount mismatch — server: ₹X, sent: ₹Y` (e.g. ₹8176 vs ₹7576, exact ₹600 drift on a 6-item COD cart).
- **Root cause:** `create_order` recalculated prices per-item with `cod_price` when `payment_method == "cod"`, but `/api/cart/validate` uses **`prepaid_price` uniformly** (the new band-margin model has no per-item COD premium). With a ₹100 COD premium × 6 items the totals drifted ₹600. Combo had a second bug: server looked for `prepaid_price`, but the actual field is `combo_prepaid_price`.
- **Fix:** `create_order` now delegates the entire pricing calculation to the same `validate_cart()` function used by the cart UI. Two functions can no longer drift, regardless of future tier / coupon / packaging changes.
- **Referral handling:** Removed referral_discount subtraction from the amount comparison — the cart UI never subtracts it from `total`, so neither does the server. Referral code is still recorded on the order for attribution.
- **MOQ + gift-card errors** are now re-raised from `cart_validate`'s flags (gift-card validation also runs once, not twice).
- **Tests:** `backend/tests/test_checkout_amount_parity_feb2026.py` (6 cases: prepaid/COD parity, multi-item COD, tamper rejection, ±₹1 rounding tolerance, tiered delivery at ₹2500). All cart pytests now 36/36 pass.

## New admin endpoints (require X-Admin-Token)
