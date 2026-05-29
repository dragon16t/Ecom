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

## Backlog
- **P0:** Send the ~9.7k product CSV/Excel — current DB has 7,863; new import will auto-classify + auto-cleanup on the way in.
- **P0:** ~2,439 products still classified with `category=null` (mostly brand-line cosmetics like "Lakme True Wear", "Elle 18 Color Pops") — keyword coverage can be expanded incrementally; admin-curate via `needs_review` flag in the meantime.
- **P1:** Frontend — render Featured Nav strip + 3 Promo Sections on `/cosmetics`. Backend ready; UI not yet wired.
- **P1:** Hook reclassifier into `bulk_import_service` so future imports auto-classify on insert.
- **P2:** Razorpay / Cloudinary / SendGrid / Delhivery / WhatsApp API keys.

## New admin endpoints (require X-Admin-Token)
