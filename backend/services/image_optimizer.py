"""Cloudinary URL transformer.

Injects `f_auto,q_auto,w_<width>` into Cloudinary delivery URLs so the CDN
serves WebP/AVIF + auto-quality + correctly-sized images, cutting page weight
70-90% without re-uploading anything.

A typical URL like:
    https://res.cloudinary.com/<cloud>/image/upload/v1700000000/abc123.jpg
becomes:
    https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_600/v1700000000/abc123.jpg

Safe — if the URL already has transforms, we don't double-stack them.
Non-Cloudinary URLs pass through untouched.
"""
from __future__ import annotations
import re
from typing import Any

_CLOUDINARY_RE = re.compile(r"(https?://res\.cloudinary\.com/[^/]+/image/upload/)(.*)")
_HAS_TRANSFORM = re.compile(r"^(f_|q_|w_|h_|c_|g_|e_|b_|r_|dpr_|fl_)")


def optimize_cloudinary_url(url: str, width: int = 600) -> str:
    """Inject f_auto,q_auto,w_<width> into a Cloudinary URL. Idempotent."""
    if not url or not isinstance(url, str):
        return url
    m = _CLOUDINARY_RE.match(url)
    if not m:
        return url
    prefix, rest = m.group(1), m.group(2)
    # If first segment is already a transform set, don't double-inject
    first_seg = rest.split("/", 1)[0]
    if _HAS_TRANSFORM.match(first_seg):
        return url
    return f"{prefix}f_auto,q_auto,w_{width}/{rest}"


def optimize_product_images(product: dict, width: int = 600) -> dict:
    """Mutate a product dict in-place — apply f_auto,q_auto,w_<width> to every
    image URL inside the standard image fields. Returns the dict for chaining."""
    if not isinstance(product, dict):
        return product
    if isinstance(product.get("images"), list):
        product["images"] = [optimize_cloudinary_url(u, width) for u in product["images"]]
    if isinstance(product.get("image"), str):
        product["image"] = optimize_cloudinary_url(product["image"], width)
    # Shade-level images for cosmetics variants
    if isinstance(product.get("shades"), list):
        for sh in product["shades"]:
            if isinstance(sh, dict) and isinstance(sh.get("image"), str):
                sh["image"] = optimize_cloudinary_url(sh["image"], width)
    return product


def optimize_products_list(products: Any, width: int = 600) -> Any:
    """Apply optimize_product_images to every product in a list."""
    if isinstance(products, list):
        for p in products:
            optimize_product_images(p, width=width)
    elif isinstance(products, dict) and isinstance(products.get("items"), list):
        for p in products["items"]:
            optimize_product_images(p, width=width)
    return products
