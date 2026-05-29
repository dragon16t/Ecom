# Celesta Glow — FINAL Bulk-Import + Routing Prompt

**One prompt to rule them all.** Paste this to E1 after every product upload. It triggers import → classify → tag → cleanup empty subs → brand cleanup → dedupe → admin panel verification → report → screenshots, end-to-end.

---

## 🚨 RULES E1 must follow

1. **Never delete** a taxonomy row or a product. Use `is_active=true/false` only.
2. **Auto-hide zero-product subcategories** from BOTH cosmetics AND skincare. A subcategory with 0 products → `is_active=false` → hidden from hub UI, category page, nav menu. Auto-reactivates when products are added.
3. **Brand sanity** — sheet names (`Sheet27`, `Sheet 2`, `Tab1`, `Page3`), numeric strings, `nan` / `null` / `unknown` / `n/a` / `-` / `tbd` must NEVER appear as a product brand. Replace via the known-brand prefix list extracted from the product name, else set brand to `null`.
4. **Total count display** — category & concern pages must show the **true DB total** (not the count of products currently loaded). Already fixed in `ConcernCategoryPage.js`.
5. **Dedupe** keeps the best row by reviews + rating, deactivates the rest.

---

## 📚 Complete taxonomy reference

### Niches (4)
`skincare` · `cosmetics` · `haircare` (auto-detected) · `anti-aging` (Celesta-Glow flagship only).

### Skincare — 13 Concerns × sub-concerns (nested `subs` array)

| # | Concern (slug) | Sub-concerns |
|---|----------------|--------------|
| 1 | `acne-breakouts` | Pimples · Cystic Acne · Whiteheads · Blackheads · Hormonal Acne · Acne Scars · Bacne |
| 2 | `pigmentation` | Dark Spots · Hyperpigmentation · Melasma · Post-Acne Marks · Uneven Tone · Tanning · Sun Damage |
| 3 | `dryness` | Dry · Flaky · Dehydrated · Rough Texture · Tight Barrier |
| 4 | `oil-sebum` | Oily · Excess Sebum · Greasy T-zone · Enlarged Pores |
| 5 | `aging` | Fine Lines · Wrinkles · Sagging · Loss of Elasticity · Crow's Feet · Neck Aging |
| 6 | `sensitivity` | Sensitive · Redness · Irritation · Burning · Damaged Barrier · Allergic Reactions |
| 7 | `texture-pores` | Open Pores · Bumpy · Uneven Texture · Congested |
| 8 | `brightening-glow` | Dull · Lack of Glow · Tired-Looking |
| 9 | `under-eye` | Dark Circles · Puffy · Eye Bags · Fine Lines Under Eyes |
| 10 | `barrier-support` | Weak Barrier · Moisture Loss · Skin Repair |
| 11 | `skin-conditions` | Eczema · Psoriasis · Rosacea · Fungal Acne · Dermatitis |
| 12 | `sun-protection` | UV Damage · Photoaging · Sunburn · Tanning Prevention |
| 13 | `mens-skincare` | Razor Bumps · Ingrown · Post-Shave Irritation |

### Skincare — 16 Categories × 75 Subcategories

`cleansers` (face-wash · gel-cleanser · foam-cleanser · cream-cleanser · oil-cleanser · micellar-water · cleansing-balm) · `exfoliators` (face-scrub · chemical-exfoliant · aha-exfoliant · bha-exfoliant · peeling-solution · enzyme-peel) · `toners-mists` · `serums-treatments` (vitamin-c · hyaluronic · niacinamide · retinol · salicylic · peptide · brightening · anti-acne) · `moisturizers` (gel · cream · lotion · night · barrier-repair) · `sunscreens` (gel · cream · mineral · tinted · spray · stick) · `masks-packs` (clay · sheet · sleeping · peel-off · mud · hydrating) · `spot-treatments` (acne-patch · spot-corrector · pimple-gel · scar) · `eye-care` (eye-cream · eye-gel · under-eye-patch) · `lip-care` (lip-balm · lip-mask · lip-scrub · lip-oil) · `face-oils` · `essences-ampoules` · `barrier-care` (cica · ceramide · recovery-balm) · `brightening-products` · `anti-aging-products` · `body-skincare` (lotion · butter · wash · scrub · oil · hand · foot)

### Cosmetics — 7 Categories × 60 Subcategories

| Category | Subcategories |
|----------|---------------|
| `face-makeup` (Face, 14) | face-primer · concealer · foundation · compact · contour · loose-powder · blush · bb-cc-cream · highlighters · setting-spray · makeup-remover · sindoor · tinted-moisturizer · bronzer |
| `lips` (8) | lipstick · liquid-lipstick · lip-crayon · lip-gloss · lip-liner · lip-primer · lip-plumper · lip-tint |
| `eyes` (10) | kajal · eyeliner · mascara · eye-shadow · eyebrow-enhancers · eye-primer · false-eyelashes · eye-makeup-remover · under-eye-concealer · contact-lenses |
| `nails` (7) | nail-polish · nail-enamel · nail-art · nail-care · nail-strengthener · cuticle-oil · nail-remover |
| `tools-brushes` (11) | face-brush · eye-brush · lip-brush · brush-sets · brush-cleaners · sponges-applicators · eyelash-curlers · tweezers · sharpeners · mirrors · makeup-pouches |
| `multi-palettes` (5) | eye-shadow-palette · face-palette · lip-palette · cheek-palette · all-in-one-palette |
| `makeup-kits` (5) | starter-kit · travel-kit · bridal-kit · gift-set · combo-set |

### Tags (auto-applied)
`bestseller` (top 15% reviews) · `luxury` (MRP ≥ ₹1500) · `trending` (4.5★ + 200 reviews) · `most_bought` (top 5% orders) · `new_launch` (top-100 newest or badge="new") · `manual:*` (admin-pinned, survives reclassify)

### Cosmetics homepage chips (12)
Bestseller · New Launch · Bridal Store · Base Makeup Routine · Foundation · Concealer · Eye Shadow · Eyeliner & Kajals · Mascara · Lipstick · Nail Polish · Tools & Brushes

### Promo sections (3)
Best Of Makeup · Brands You Will Love · Find Your Perfect Match

### Cosmetics-leaning brands (auto)
Lakme · LK · L'Oreal / Loreal · Maybelline · ML · Sugar · Faces Canada · MAC · Mars · Miss Claire · Huda · ColorBar · Nykaa Cosmetics · Elle 18 · Swiss Beauty · Insight · Blue Heaven · Kay Beauty · Rimmel · Revlon · Chambor · Mamaearth Makeup · Too Faced · Fenty Beauty · Charlotte Tilbury · Tarte · Urban Decay · Benefit · NARS · Bobbi Brown · Clinique · Smashbox · Stila · Hourglass · Pat McGrath · Pixi · Milani · Wet n Wild · e.l.f. · Anastasia · Becca · Tower 28 · Rare Beauty · Patrick Ta · Forever 52 · Renee · Pac · Mirabella · Krylon · Revolution

---

## 🛠 Admin panel — already wired (no new build needed)

The admin panel at `/admin` already supports everything for ongoing curation:

| Section | What it does |
|---------|--------------|
| **Admin → Products** | Add/edit any product with **niche → category → subcategory → concerns** dropdowns. Subcategory list auto-filters by selected category and excludes deactivated ones. Concerns multi-select for skincare. Image upload built-in. "AI Analyze" button per product auto-classifies + auto-creates missing taxonomy. |
| **Admin → Concerns & Categories** | Four tabs: **Skincare Concerns** · **Cosmetic Concerns** · **Categories** (per niche, with editable title, icon, image, tagline) · **Subcategories** (with parent picker). Each row has Edit + Delete (deactivates). |
| **Admin → Bulk Import (Excel)** | Upload CSV / XLSX. Maps columns. Triggers classify + tag + cleanup at the end. |
| **Admin → AI Studio** | One-click AI audit over the whole catalog: re-routes every product, creates missing taxonomy rows, prints summary. |
| **Admin → Shop by Category Hub** | Visual editor for the cosmetics homepage Featured Nav (12 chips) + Promo Sections (3). |

For every category/subcategory row: **title text + icon + image are all editable in-place** from the Concerns & Categories page.

---

## 🎯 THE FINAL PROMPT — copy-paste this after every bulk upload

```
I uploaded a new product file at <path-or-attachment> (sheet: <sheet-name-or-blank>).
Run the FULL Celesta Glow taxonomy routing end-to-end.

=== HARD RULES ===
- Never delete a row or a product. Use is_active=true/false only.
- Auto-hide every subcategory (skincare AND cosmetics) that ends up with 0 products. Auto-reactivate when they get products.
- Brand field must NEVER show "Sheet27" / "Sheet 2" / "Tab1" / numeric / "nan" / "null" / blank. Repair via known-brand prefix list extracted from product name; else set brand=null.
- Category and concern pages must show the TRUE DB total in the heading (not the loaded count).
- Dedupe keeps the row with most reviews + highest rating; losers get is_active=false + dedup_merged_into=<keeper_slug>.

=== TAXONOMY (do not invent slugs, use these exact ones) ===
NICHES: skincare · cosmetics · haircare · anti-aging.

SKINCARE 13 CONCERNS (with subs):
acne-breakouts (Pimples · Cystic Acne · Whiteheads · Blackheads · Hormonal Acne · Acne Scars · Bacne)
pigmentation (Dark Spots · Hyperpigmentation · Melasma · Post-Acne Marks · Uneven Tone · Tanning · Sun Damage)
dryness (Dry · Flaky · Dehydrated · Rough Texture · Tight Barrier)
oil-sebum (Oily · Excess Sebum · Greasy T-zone · Enlarged Pores)
aging (Fine Lines · Wrinkles · Sagging · Loss of Elasticity · Crow's Feet · Neck Aging)
sensitivity (Sensitive · Redness · Irritation · Burning · Damaged Barrier · Allergic Reactions)
texture-pores (Open Pores · Bumpy · Uneven Texture · Congested)
brightening-glow (Dull · Lack of Glow · Tired-Looking)
under-eye (Dark Circles · Puffy · Eye Bags · Fine Lines Under Eyes)
barrier-support (Weak Barrier · Moisture Loss · Skin Repair)
skin-conditions (Eczema · Psoriasis · Rosacea · Fungal Acne · Dermatitis)
sun-protection (UV Damage · Photoaging · Sunburn · Tanning Prevention)
mens-skincare (Razor Bumps · Ingrown · Post-Shave Irritation)

SKINCARE 16 CATEGORIES × 75 SUBCATEGORIES:
cleansers           → face-wash · gel-cleanser · foam-cleanser · cream-cleanser · oil-cleanser · micellar-water · cleansing-balm
exfoliators         → face-scrub · chemical-exfoliant · aha-exfoliant · bha-exfoliant · peeling-solution · enzyme-peel
toners-mists        → toner · face-mist · hydrating-mist · exfoliating-toner
serums-treatments   → vitamin-c-serum · hyaluronic-acid-serum · niacinamide-serum · retinol-serum · salicylic-acid-serum · peptide-serum · brightening-serum · anti-acne-serum
moisturizers        → gel-moisturizer · cream-moisturizer · lotion · night-cream · barrier-repair-cream
sunscreens          → gel-sunscreen · cream-sunscreen · mineral-sunscreen · tinted-sunscreen · spray-sunscreen · stick-sunscreen
masks-packs         → clay-mask · sheet-mask · sleeping-mask · peel-off-mask · mud-mask · hydrating-mask
spot-treatments     → acne-patch · spot-corrector · pimple-gel · scar-treatment
eye-care            → eye-cream · eye-gel · under-eye-patch
lip-care            → lip-balm · lip-mask · lip-scrub · lip-oil
face-oils           → facial-oil · overnight-oil · glow-oil
essences-ampoules   → essence · ampoule · booster
barrier-care        → cica-cream · ceramide-cream · recovery-balm
brightening-products→ pigmentation-cream · dark-spot-corrector · glow-cream
anti-aging-products → retinol-cream · firming-cream · wrinkle-treatment
body-skincare       → body-lotion · body-butter · body-wash · body-scrub · body-oil · hand-cream · foot-cream

COSMETICS 7 CATEGORIES × 60 SUBCATEGORIES:
face-makeup (14)    → face-primer · concealer · foundation · compact · contour · loose-powder · blush · bb-cc-cream · highlighters · setting-spray · makeup-remover · sindoor · tinted-moisturizer · bronzer
lips (8)            → lipstick · liquid-lipstick · lip-crayon · lip-gloss · lip-liner · lip-primer · lip-plumper · lip-tint
eyes (10)           → kajal · eyeliner · mascara · eye-shadow · eyebrow-enhancers · eye-primer · false-eyelashes · eye-makeup-remover · under-eye-concealer · contact-lenses
nails (7)           → nail-polish · nail-enamel · nail-art · nail-care · nail-strengthener · cuticle-oil · nail-remover
tools-brushes (11)  → face-brush · eye-brush · lip-brush · brush-sets · brush-cleaners · sponges-applicators · eyelash-curlers · tweezers · sharpeners · mirrors · makeup-pouches
multi-palettes (5)  → eye-shadow-palette · face-palette · lip-palette · cheek-palette · all-in-one-palette
makeup-kits (5)     → starter-kit · travel-kit · bridal-kit · gift-set · combo-set

TAGS: bestseller (top 15% reviews) · luxury (MRP ≥ ₹1500) · trending (4.5★ + 200 reviews) · most_bought (top 5% orders) · new_launch (top-100 newest or badge="new") · manual:* (admin-pinned, never overwritten)

COSMETICS FEATURED NAV (12 chips): Bestseller · New Launch · Bridal Store · Base Makeup Routine · Foundation · Concealer · Eye Shadow · Eyeliner & Kajals · Mascara · Lipstick · Nail Polish · Tools & Brushes
COSMETICS PROMO SECTIONS (3): Best Of Makeup · Brands You Will Love · Find Your Perfect Match

COSMETICS-LEANING BRANDS (auto-hint): Lakme · LK · L'Oreal · Maybelline · ML · Sugar · Faces Canada · MAC · Mars · Miss Claire · Huda · ColorBar · Nykaa Cosmetics · Elle 18 · Swiss Beauty · Insight · Blue Heaven · Kay Beauty · Rimmel · Revlon · Chambor · Mamaearth Makeup · Too Faced · Fenty · Charlotte Tilbury · Tarte · Urban Decay · Benefit · NARS · Bobbi Brown · Clinique · Smashbox · Stila · Hourglass · Pat McGrath · Pixi · Milani · Wet n Wild · e.l.f. · Anastasia · Becca · Tower 28 · Rare Beauty · Patrick Ta · Forever 52 · Renee · Pac · Mirabella · Krylon · Revolution

=== STEPS ===

1) IMPORT — Read the file, map columns (name, description, brand, mrp, prepaid_price, image_url, sku, stock_qty, rating, reviews_count, badge, optional niche/category/subcategory/concerns/tags). Confirm only if a required column is ambiguous. If Excel has multiple sheets, DO NOT carry sheet name into brand. Skip exact-name duplicates already in DB.

2) CLASSIFY — POST /api/admin/taxonomy/reclassify-products
   This single call also auto-runs cleanup_empty_taxonomy AND cleanup_bad_brands at the end. Definitive cosmetics keywords (concealer/foundation/lipstick/mascara/kajal/blush/bronzer/highlighter/contour/nail-polish/sindoor/BB-CC/9to5/setting-spray/eye-shadow/palette/etc.) ALWAYS beat soft skincare ingredient words (Vit C / Niacinamide / Hyaluronic). Hair products → niche=haircare. Skincare gets up to 3 concerns. Subcategory matcher handles plurals (Highlighter↔Highlighters) and composite names (BB & CC Cream).

3) TAGS — POST /api/admin/taxonomy/recompute-tags
   Preserves manual: overrides. Sets bestseller / luxury / trending / most_bought / new_launch.

4) CLEANUP EMPTY SUBS — POST /api/admin/taxonomy/cleanup-empty
   (Already runs inside step 2; call again explicitly to print the report.) For BOTH cosmetics AND skincare: deactivates every subcategory with 0 products → hidden everywhere. Reactivates when products are added. Parents stay active if parent or any child has products.

5) BRAND CHECK — POST /api/admin/products/cleanup-bad-brands
   (Already runs inside step 2.) Repairs sheet names, numeric, blank, "nan", "null", short codes. Extracts from product name via known-brand list, else sets brand=null.

6) DEDUPE — POST /api/admin/products/dedupe?dry_run=false
   Deactivates exact-name duplicates; keeps the row with most reviews + highest rating.

7) ADMIN PANEL VERIFY — Confirm the admin panel can:
   - Add a new product with niche → category → subcategory → concerns (skincare) dropdowns wired live (Admin → Products → New Product).
   - Edit any (sub)category's title, icon, image, tagline (Admin → Concerns & Categories → Categories tab).
   - Create a new parent category with title and add subcategories under it (Admin → Concerns & Categories → Categories tab → Add, then Subcategories tab → Add with parent picker).
   - Upload / change images on every concern + category + subcategory.

8) REPORT — print:
   - Imported count, total products, niche breakdown.
   - Top 20 categories with counts.
   - Newly-activated and newly-deactivated subcategories (per niche).
   - Top 30 products with needs_review=true (so I can spot keyword gaps).
   - Counts per filter tag.
   - Brand-fix summary (how many fixed, breakdown by extracted brand, how many set to null).
   - Dedupe summary.

9) SCREENSHOTS — /cosmetics, /skincare, /category/foundation, /category/lipstick, /category/concealer, /admin/concerns, /admin/products (New Product modal). I need to see:
   - Tile counts updated, no empty tiles.
   - Category heading shows TRUE TOTAL (not the loaded subset).
   - Product cards never show "Sheet27" or any sheet name as the brand.
   - Admin product editor has working niche → category → subcategory → concerns chain.

If a subcategory I expect to be populated is still at 0, OR a brand still shows as "Sheet…" / numeric / blank, OR the heading on a category page shows the loaded count instead of the total, suggest the exact code/keyword changes and re-run the affected step.
```

---

## 📂 CSV/Excel column reference

| Required | Recommended |
|----------|-------------|
| `name` | `description`, `brand` (drives classifier accuracy) |
| `mrp` | `prepaid_price`, `cod_price`, `discount_percent` |
| | `image_url`, `image_url_2`, `image_url_3` |
| | `niche` (force override), `category`, `subcategory` |
| | `concerns` (comma-separated), `tags` (comma-separated, `manual:` prefix to lock) |
| | `sku`, `stock_qty`, `weight_grams`, `country_of_origin`, `ingredients` |
| | `rating`, `reviews_count`, `badge` |

Column names case-insensitive. Classifier reads `name` + `description` + `brand`.
