# Changelog

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
