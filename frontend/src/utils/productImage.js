/**
 * Resolve a product image string to an absolute URL the browser can load.
 *
 * Background: legacy admin uploads stored relative paths like
 * `/api/uploads/products/xxx.jpg`. New Cloudinary uploads are absolute
 * `https://res.cloudinary.com/...`. Both shapes coexist in the DB, so every
 * place that renders a product image must normalise.
 *
 *   - empty / null / undefined  → fallback placeholder
 *   - http://, https://, data:, blob: → returned as-is
 *   - "/api/uploads/..." or any other "/..." → prefixed with REACT_APP_BACKEND_URL
 */
const FALLBACK = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400';
const API_HOST = process.env.REACT_APP_BACKEND_URL || '';

export function resolveImageUrl(raw, fallback = FALLBACK) {
  if (!raw) return fallback;
  const s = String(raw);
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (s.startsWith('/')) return `${API_HOST}${s}`;
  return s;
}

/** Get the primary image URL for a product, handling all known field shapes. */
export function productPrimaryImage(p, fallback = FALLBACK) {
  if (!p) return fallback;
  const raw =
    (Array.isArray(p.images) && p.images[0]) ||
    p.image_url ||
    p.image ||
    p.thumbnail ||
    null;
  return resolveImageUrl(raw, fallback);
}
