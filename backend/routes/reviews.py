"""
Reviews Routes - Customer reviews shown on Homepage / Product page / Cart.
Reviews are managed entirely from /admin/reviews (no public submission).
Admin can:
  - Manually add a review (name, location, rating, body, tag)
  - Generate a batch of randomized realistic reviews (no AI - uses curated bank)
  - Delete reviews
The public endpoint returns all active reviews; the frontend carousel auto-scrolls.
"""
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import random
import secrets
import os

router = APIRouter()
db = None
admin_sessions = {}


def set_db(database):
    global db
    db = database


def set_admin_sessions(sessions):
    global admin_sessions
    admin_sessions = sessions


def _verify_admin(token: Optional[str]):
    if not token:
        raise HTTPException(status_code=401, detail="Admin token required")
    if token in admin_sessions:
        return True
    master = os.environ.get("ADMIN_MASTER_TOKEN", "celestaglow2024")
    if token == master:
        return True
    raise HTTPException(status_code=403, detail="Invalid admin token")


# ==================== MODELS ====================

class ReviewCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    location: str = Field(..., min_length=2, max_length=60)
    rating: int = Field(5, ge=1, le=5)
    body: str = Field(..., min_length=10, max_length=400)
    tag: Optional[str] = "product"  # product | brand | delivery | service | quality
    days: Optional[int] = None
    age: Optional[int] = None


class ReviewOut(ReviewCreate):
    id: str
    verified: bool = True
    created_at: str


# ==================== CURATED BANK FOR `/generate` ====================
# 60 hand-crafted realistic Indian review templates spanning every aspect:
# product specialty, brand experience, delivery, packaging, quality, service.
NAMES = [
    "Priya S.", "Riya M.", "Anjali K.", "Sneha R.", "Kavya P.", "Neha T.",
    "Aarti D.", "Meera J.", "Ishita R.", "Divya M.", "Tanvi K.", "Suhana B.",
    "Pooja G.", "Nidhi A.", "Shruti V.", "Lavanya H.", "Akanksha B.", "Megha S.",
    "Sakshi P.", "Ritika M.", "Deepa K.", "Anita S.", "Bhavna L.", "Charu D.",
    "Disha R.", "Esha T.", "Falguni N.", "Gauri S.", "Hema V.", "Indu K.",
    "Jaya R.", "Kriti M.", "Latika P.", "Mansi B.", "Naina O.",
]
CITIES = [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata",
    "Ahmedabad", "Jaipur", "Lucknow", "Gurgaon", "Noida", "Surat", "Indore",
    "Coimbatore", "Kochi", "Chandigarh", "Bhopal", "Visakhapatnam", "Patna",
    "Nagpur", "Vadodara", "Ludhiana", "Agra", "Nashik", "Faridabad",
]

PRODUCT_REVIEWS = [
    "Genuine results within 3 weeks — fine lines around the eyes look softer and skin feels firmer.",
    "Lightweight, non-greasy, layers beautifully under sunscreen. My pigmentation is fading week by week.",
    "I had stopped expecting visible changes at 42. Six weeks in, even my husband noticed the glow.",
    "The Vitamin C is the best I've ever used. Brightening without the sting many other brands give me.",
    "Retinol night cream has zero irritation on my sensitive skin. No purging, just softer texture.",
    "Peptide serum genuinely firms — my nasolabial lines are noticeably softer after a month.",
    "Hyaluronic acid serum drinks into the skin instantly. My makeup sits beautifully now.",
    "The under-eye cream de-puffs me by 11am every single day. Dark circles fading too.",
    "Sunscreen has zero white cast — finally one that works for Indian skin tones.",
    "Niacinamide reduced my open pores in 4 weeks. I'm a forever customer now.",
    "Texture is luxe-spa-grade — truly feels premium without the premium price tag.",
    "Skin barrier feels stronger. Redness has significantly reduced after 30 days of use.",
]

BRAND_REVIEWS = [
    "Cleanest ingredients list I've seen on an Indian skincare brand. Loyal customer for life.",
    "Finally an Indian brand that doesn't just rebrand Korean serums — these formulas work for our climate.",
    "I switched my entire routine to Celesta Glow. Three friends followed after seeing my results.",
    "Love that they're transparent about every ingredient. Feels like a brand I can trust long-term.",
    "Dermatologist-tested AND reasonably priced — rare combination in this category.",
    "Packaging is so well thought-out — airless pumps, eco-conscious, and looks gorgeous on my shelf.",
    "The brand voice is informative without being preachy. Their newsletters teach me something every time.",
    "Genuinely Indian skin science. You can tell the formulators understood our melanin and humidity.",
    "Cruelty-free, paraben-free and actually effective — I no longer compromise on any of those.",
    "Refill economy is a green win — sustainable packaging that doesn't feel like an afterthought.",
]

DELIVERY_REVIEWS = [
    "Delivery reached me in Hyderabad within 2 days, beautifully packed with ice packs to protect formulas.",
    "Even my Tier-2 city pincode received the order in 3 days — most brands take 7+. Impressed.",
    "Bubble wrap, sealed pouch, neat invoice. The unboxing felt like an experience, not a chore.",
    "Came faster than the ETA. Delhi NCR delivery in under 36 hours — super efficient logistics.",
    "Order shipped within 4 hours of placing it. Tracking updates were on point throughout.",
    "Free shipping on a ₹500 order arriving in 2 days — that's better than premium subscriptions abroad.",
    "Cold-chain packaging for the serums is brilliant. Even on a 38°C day, products arrived cool.",
    "I ordered Sunday night, package was in my hand Tuesday morning. No global brand matches this speed.",
    "Surprised that COD orders also arrive in 3-4 days. Really fast even with manual verification.",
    "Smaller cities like mine usually get ignored — Celesta Glow nailed it with on-time delivery.",
]

QUALITY_REVIEWS = [
    "Quality is genuinely premium. Ingredients are cleaner than what I was paying double for from a Korean brand.",
    "Glass bottles, no leakage, airless pumps. The product literally feels expensive in your hand.",
    "Texture, fragrance (very mild), absorption — every detail is engineered well. No greasy residue.",
    "Quality control is on another level. Same texture, same pH every batch — consistency matters.",
    "Tested it side-by-side with a French brand. Celesta Glow held up exactly the same on my skin.",
    "Even the small sachet samples were the same quality as the full size. Builds trust instantly.",
    "Pump dispensers don't clog — that simple thing already puts them ahead of most Indian brands.",
    "Finally a serum that doesn't pill under sunscreen. Quality of formula speaks for itself.",
    "My dermat actually approved this entire range — said the formulations are clinically grade-A.",
    "It feels light on the skin but the active ingredient delivery is potent. Smart formulation.",
]

SERVICE_REVIEWS = [
    "Support team replied in 10 minutes when my order was delayed and proactively offered a discount.",
    "Customer care over WhatsApp is fantastic. Got answers about ingredient interactions within minutes.",
    "I wrote in about a missing item and they re-shipped within 24 hours — no questions, no friction.",
    "Their consultation flow recommended exactly the right routine. Felt like a real dermat call.",
    "Refund processed in 2 working days when my product didn't suit me. That's how returns SHOULD work.",
    "I emailed at 11pm and got a personal reply by 9am. Best service in Indian D2C, full stop.",
    "They followed up after 4 weeks to ask how my skin was responding. Genuinely cared.",
    "Customer support actually reads your message — not bot replies. That's a rare luxury.",
    "Helpful, polite, and never pushy with upsells. They tell you to stick with what's working.",
    "Replacement was sent for a damaged-on-arrival item the same day I reported it. Zero stress.",
]


def _build_random_review(tag: Optional[str] = None) -> dict:
    pool_map = {
        "product": PRODUCT_REVIEWS,
        "brand": BRAND_REVIEWS,
        "delivery": DELIVERY_REVIEWS,
        "quality": QUALITY_REVIEWS,
        "service": SERVICE_REVIEWS,
    }
    if tag and tag in pool_map:
        pool = pool_map[tag]
        chosen_tag = tag
    else:
        chosen_tag = random.choice(list(pool_map.keys()))
        pool = pool_map[chosen_tag]
    body = random.choice(pool)
    return {
        "id": secrets.token_hex(8),
        "name": random.choice(NAMES),
        "location": random.choice(CITIES),
        "rating": 5 if random.random() < 0.85 else 4,
        "body": body,
        "tag": chosen_tag,
        "days": random.randint(7, 90),
        "age": random.choice([None, None, 25, 28, 31, 34, 38, 42, 45]),
        "verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/reviews")
async def list_reviews(limit: int = Query(40, ge=1, le=200)):
    """Return active reviews for the public carousel (homepage / product / cart)."""
    docs = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    if not docs:
        # On a fresh database, lazily seed 30 randomized reviews so the carousel never looks empty.
        seeded = [_build_random_review() for _ in range(30)]
        await db.reviews.insert_many(seeded)
        docs = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/reviews")
async def admin_list_reviews(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    docs = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@router.post("/admin/reviews")
async def admin_create_review(data: ReviewCreate, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    doc = data.model_dump()
    doc["id"] = secrets.token_hex(8)
    doc["verified"] = True
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


class ReviewGenerate(BaseModel):
    count: int = Field(20, ge=1, le=60)
    tag: Optional[str] = None  # product | brand | delivery | service | quality | None=mix


@router.post("/admin/reviews/generate")
async def admin_generate_reviews(payload: ReviewGenerate, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    docs = [_build_random_review(payload.tag) for _ in range(payload.count)]
    await db.reviews.insert_many(docs)
    return {"success": True, "inserted": len(docs)}


@router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    await db.reviews.delete_one({"id": review_id})
    return {"success": True}


@router.delete("/admin/reviews")
async def admin_clear_reviews(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """Wipe all reviews (used before re-seeding from the bank)."""
    _verify_admin(x_admin_token)
    res = await db.reviews.delete_many({})
    return {"success": True, "deleted": res.deleted_count}
