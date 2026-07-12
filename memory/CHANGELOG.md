# Changelog

## 2026-02 Session — Iteration A (Flat 50% + Location pill)
### Global sale mode (anti-aging only)
- New `sale_mode` collection in admin_settings with fields: enabled,
  discount_percent, applies_to_niches, badge_label, banner_text,
  urgency_line, zero_shipping, zero_tax, banner_image_desktop,
  banner_image_mobile. Public read at `GET /api/sale-mode`. Admin CRUD
  at `PUT /api/admin/sale-mode` + banner upload at
  `POST /api/admin/sale-mode/banner?field=banner_image_desktop|mobile`.
- Frontend `useSaleMode()` hook cached in-memory, notifies subscribers.
- `applySale(saleMode, niche, price)` helper — returns discounted price
  + `saved` amount when the niche qualifies.
- `<HomepageSaleStrip />` mounted on the Homepage top — appears
  automatically when the admin toggles the switch ON.
- Admin `/admin/extras` → new "Flat 50% OFF Switch" tab with big toggle,
  live copy editors (badge, banner text, urgency), % editor, and dual
  banner uploaders (desktop + mobile).

### Location pill (Iteration A skeleton)
- `<LocationPill />` in the header — matches your reference design pill.
  Tap → modal with "Use my current location" (browser geolocation +
  Google reverse-geocode) or search box (Google Places Autocomplete,
  India-only). Result stored in localStorage. Shows locality + district
  in the pill.
- Google Maps API key stored in both `.env` files:
  `REACT_APP_GOOGLE_MAPS_API_KEY` (frontend) and `GOOGLE_MAPS_API_KEY`
  (backend, for Iteration B serviceability calls).
- **Iteration B TODO**: full multi-warehouse system, serviceability
  engine, delivery ETA, warehouse admin CRUD, order snapshot, warehouse
  dashboard, coverage map.

### Testing
- iteration_16.json: 9/9 backend PASS, all frontend flows PASS, 0 issues,
  retest=false.

## 2026-02 Session — Growth batch (Phase 1 + 2 + 3)
### Phase 1
- **Pinterest domain verification** meta tag added to `public/index.html` (`p:domain_verify=932ef79d89721ec0b913511dbea52c73`).
- **Google Analytics 4** wired in `public/index.html` (`G-QYDN365M5N`).
- **Skincare "Shop by Category" tiles**: new admin-managed collection
  `shop_by_category_tiles` with separate images (independent of the
  /admin/categories editor). Admin CRUD at
  `POST/PUT/DELETE /api/admin/shop-by-category`. Public feed at
  `GET /api/shop-by-category?niche=skincare`. Rendered on `SkincareHome.js`
  below "Shop by Concern".
- (Follow-up) Anti-aging cleanser URL bug on production — not reproduced
  yet, need URL sample from user.

### Phase 2 — Leads
- 3 public lead-form pages: `/partner-with-us`, `/invest-now`,
  `/free-skin-advice`, all wired to a single `POST /api/leads` endpoint.
- Admin `/admin/extras` → **Leads tab** with type filter + status
  workflow (new → contacted → qualified → converted → closed).
- Unified `LeadFormPage.js` (3-in-1) with per-type fields
  (business_name, investment_amount, concern).

### Phase 3 — Sale Campaigns
- `sale_campaigns` collection + admin CRUD at
  `/api/admin/sale-campaigns` with revenue + order_count aggregation.
- Public landing at `/sale/{slug}` (`SalePage.js`) with urgency
  countdown, MRP vs Sale price panel, hero image, featured products,
  sticky bottom CTA, trust strip.
- **Attribution**: SalePage writes `sale_campaign_slug` to
  sessionStorage; CheckoutPage attaches it to the order payload as
  `campaign_slug`; server stores it on the order. Admin sale tab
  shows per-campaign revenue + order_count.
- Admin `/admin/extras` → **Sale Campaigns tab** with copy-link, active
  toggle, subtitle / trust / featured_slugs editors.

### Testing
- Fast test via testing_agent (iteration_15.json): 20/20 backend
  tests PASS, all frontend flows verified, 0 issues.

## 2026-02 Session — UI polish + P1
### UI / theme
- **Doctor Consultation page**: switched theme from rose/pink to emerald/green
  (clinical/medical aesthetic). All `rose-*` / `pink-*` Tailwind classes +
  Razorpay theme color (`#be185d` → `#059669`) replaced in
  `DoctorConsultationPage.js`. Tested PASS.

### P1 — Admin Orders enhancements
- **Status badge on each order card**: icon + color-coded pill (Confirmed
  amber · Processing blue · Shipped indigo · In Transit purple · Delivered
  emerald · Cancelled rose · Returned stone). `OrderStatusBadge`
  component, `data-testid='order-status-badge-<order_id>'`.
- **`resolveStatus` helper**: a shipped order with an AWB number now
  renders as "In Transit" automatically (Delhivery picked it up).
- **Prominent banner on order detail modal**: full-width gradient banner
  at top showing icon + ORDER STATUS label + status name + AWB on right.
  `data-testid='order-detail-status-banner'`.
- **Calendar tap-to-filter** in orders toolbar: new "Calendar" button
  (`data-testid='open-calendar-btn'`) opens a `react-day-picker` popover
  showing dots on days that have orders. Tap any day → filters list to
  that date. Clear button resets. `data-testid='orders-calendar-popover'`
  / `data-testid='calendar-clear-btn'`. Tested with 37 live orders across
  Confirmed / Shipped / In Transit / Delivered — PASS.

## 2026-02 Session — P0 Fixes + Doctor Consultation
### Bug fixes
- **P0 image-loss on pod restart**: synced `CANONICAL_VERSION` between
  `server.py` and `taxonomy_canonical.py` ("2026-02-granular-subs-v5"). Reset
  no longer runs on every restart. Added admin-visual preservation inside
  `reset_canonical_taxonomy` (snapshots image/icon/accent_* before delete,
  re-applies after canonical insert). Reordered startup so
  `auto_restore_if_empty` runs BEFORE taxonomy. Added skeleton-state
  detection in `auto_restore_if_empty`.
- **P0 manual restore brings old data**:
  - `_fetch_latest_snapshot` rewritten to query Cloudinary admin API across
    BOTH new + legacy accounts and pick NEWEST full by `created_at` (stale
    pinned `latest_url` only used as last-resort fallback).
  - Added skeleton-state guard to both `incremental_snapshot()` and
    `snapshot()` (refuse upload when <20% of categories carry image URL).
  - Manual restore now takes a fresh full snapshot after success →
    establishes a clean baseline + Cloudinary retention sweep prunes the
    skeleton-tainted incrementals.
  - New POST `/api/admin/catalog/backup/restore-async` returns immediately
    with a `job_id`; UI polls GET `/restore/status?job_id=X`. Solves the
    Cloudflare 60s proxy timeout that was killing the sync /restore.
    409 concurrency guard prevents racing restores. (10 quick tests +
    public-APIs-during-restore + post-restore data quality all PASS.)

### New features
- **Doctor Consultation (₹999)**: public page at `/doctor-consultation` with
  Razorpay checkout, 3 seeded doctors, 6 seeded reviews. Admin panel at
  `/admin/doctor-bookings` with bookings table, status workflow (new →
  scheduled → consulted → closed), patient-photo + PDF-report uploads to
  Cloudinary (per-booking folder). SendGrid email confirmation to customer
  + admin alert. (23 backend cases + frontend smoke all PASS.)
