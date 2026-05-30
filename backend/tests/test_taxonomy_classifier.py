"""Unit tests for granular taxonomy classifier (services/taxonomy_canonical.py).

Each test case provides a representative product name from the 7k+ live catalog
and the expected (niche, category, subcategory). Run with:
    cd /app/backend && python -m pytest tests/test_taxonomy_classifier.py -v
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.taxonomy_canonical import classify_product  # noqa: E402


# ============================================================
# SKINCARE — CLEANSERS (granular by texture/form)
# ============================================================
CLEANSER_CASES = [
    ("Cetaphil Gentle Skin Cleanser", "cleansers", "face-wash"),
    ("Plum Green Tea Foaming Face Wash", "cleansers", "foam-cleanser"),
    ("Mamaearth Vitamin C Foaming Face Wash", "cleansers", "foam-cleanser"),
    ("Minimalist 2% Salicylic Acid Foaming Cleanser", "cleansers", "foam-cleanser"),
    ("Plum Hello Aloe Gentle Gel Cleanser", "cleansers", "gel-cleanser"),
    ("CeraVe Hydrating Cream Cleanser", "cleansers", "cream-cleanser"),
    ("DHC Deep Cleansing Oil", "cleansers", "oil-cleanser"),
    ("Banila Co Clean It Zero Cleansing Balm", "cleansers", "cleansing-balm"),
    ("Bioderma Sensibio H2O Micellar Water", "cleansers", "micellar-water"),
    ("Garnier Skin Naturals Micellar Cleansing Water", "cleansers", "micellar-water"),
    ("Himalaya Purifying Neem Face Wash", "cleansers", "face-wash"),
    ("Pond's Pure White Anti-Pollution Facewash", "cleansers", "face-wash"),
]


# ============================================================
# SKINCARE — EXFOLIATORS
# ============================================================
EXFOLIATOR_CASES = [
    ("St. Ives Apricot Face Scrub", "exfoliators", "face-scrub"),
    ("The Ordinary AHA 30% + BHA 2% Peeling Solution", "exfoliators", "peeling-solution"),
    ("Paula's Choice 2% BHA Liquid Exfoliant", "exfoliators", "bha-exfoliant"),
    ("The Ordinary Glycolic Acid 7% Toning Solution AHA Exfoliant", "exfoliators", "aha-exfoliant"),
    ("Dermalogica Daily Microfoliant Enzyme Peel", "exfoliators", "enzyme-peel"),
    ("Plum 1% Mandelic Acid + Acai Berry Glow Peel", "exfoliators", "chemical-exfoliant"),
    ("WOW Skin Science Apple Cider Vinegar Face Scrub", "exfoliators", "face-scrub"),
]


# ============================================================
# SKINCARE — TONERS & MISTS
# ============================================================
TONER_CASES = [
    ("Plum Chamomile & White Tea Calming Toner", "toners-mists", "toner"),
    ("Mamaearth Vitamin C Face Toner", "toners-mists", "toner"),
    ("Forest Essentials Pure Rosewater Facial Mist", "toners-mists", "face-mist"),
    ("Kama Ayurveda Pure Rose Water Hydrating Mist", "toners-mists", "hydrating-mist"),
    ("Dot & Key 24Hr Hydrating Watermelon Hyaluronic Toner", "toners-mists", "toner"),
]


# ============================================================
# SKINCARE — SERUMS (granular by active ingredient)
# ============================================================
SERUM_CASES = [
    ("Minimalist 10% Vitamin C Face Serum", "serums-treatments", "vitamin-c-serum"),
    ("Plum 15% Vitamin C Face Serum", "serums-treatments", "vitamin-c-serum"),
    ("The Ordinary Hyaluronic Acid 2% + B5 Serum", "serums-treatments", "hyaluronic-acid-serum"),
    ("Minimalist 2% Hyaluronic Acid Hydrating Serum", "serums-treatments", "hyaluronic-acid-serum"),
    ("The Ordinary Niacinamide 10% + Zinc 1%", "serums-treatments", "niacinamide-serum"),
    ("Minimalist 10% Niacinamide Face Serum", "serums-treatments", "niacinamide-serum"),
    ("Minimalist 0.3% Retinol Anti-Aging Face Serum", "serums-treatments", "retinol-serum"),
    ("Plum 2% Salicylic Acid + Tea Tree Serum", "serums-treatments", "salicylic-acid-serum"),
    ("The Derma Co. Peptide Skin Lifting Serum", "serums-treatments", "peptide-serum"),
    ("Plum 5% Alpha Arbutin & Vitamin C Brightening Serum", "serums-treatments", "brightening-serum"),
    ("Minimalist 2% Salicylic Acid Anti-Acne Serum", "serums-treatments", "salicylic-acid-serum"),
]


# ============================================================
# SKINCARE — MOISTURIZERS
# ============================================================
MOISTURIZER_CASES = [
    ("Plum Green Tea Mattifying Moisturizer", "moisturizers", "cream-moisturizer"),
    ("Neutrogena Hydro Boost Water Gel", "moisturizers", "gel-moisturizer"),
    ("Olay Total Effects 7-in-1 Night Cream", "moisturizers", "night-cream"),
    ("Pond's Super Light Gel Moisturiser", "moisturizers", "gel-moisturizer"),
    ("Mamaearth Vitamin C Daily Glow Face Cream", "moisturizers", "cream-moisturizer"),
    ("CeraVe Moisturising Lotion", "moisturizers", "lotion"),
]


# ============================================================
# SKINCARE — SUNSCREENS
# ============================================================
SUNSCREEN_CASES = [
    ("Minimalist Multi-Vitamin SPF 50 Sunscreen", "sunscreens", "cream-sunscreen"),
    ("Re'equil Ultra Matte Dry Touch Sunscreen Gel SPF 50", "sunscreens", "gel-sunscreen"),
    ("La Roche-Posay Anthelios Mineral Sunscreen SPF 50", "sunscreens", "mineral-sunscreen"),
    ("Lakme Sun Expert Tinted Sunscreen SPF 50", "sunscreens", "tinted-sunscreen"),
    ("Neutrogena Ultra Sheer Body Sunscreen Spray SPF 50", "sunscreens", "spray-sunscreen"),
]


# ============================================================
# SKINCARE — MASKS
# ============================================================
MASK_CASES = [
    ("Innisfree My Real Squeeze Mask - Aloe Sheet Mask", "masks-packs", "sheet-mask"),
    ("Plum Green Tea Clay Mask", "masks-packs", "clay-mask"),
    ("L'Oréal Paris Pure Clay Detox Mud Mask", "masks-packs", "mud-mask"),
    ("Laneige Water Sleeping Mask", "masks-packs", "sleeping-mask"),
]


# ============================================================
# SKINCARE — LIP/EYE/FACE OILS/SPOT/BARRIER/BODY
# ============================================================
MISC_SKINCARE_CASES = [
    ("Carmex Classic Lip Balm", "lip-care", "lip-balm"),
    ("Plum Lip Oil Hydrating Pink", "lip-care", "lip-oil"),
    ("Sara Happ The Lip Scrub", "lip-care", "lip-scrub"),
    ("Olay Eyes Brightening Eye Cream", "eye-care", "eye-cream"),
    ("Plum Bright Years Anti-Aging Eye Gel", "eye-care", "eye-gel"),
    ("COSRX Acne Pimple Master Patch", "spot-treatments", "acne-patch"),
    ("La Shield Pimple Gel", "spot-treatments", "pimple-gel"),
    ("Mederma Scar Gel", "spot-treatments", "scar-treatment"),
    ("Plum Avocado & Squalane Glow-Renew Facial Oil", "face-oils", "facial-oil"),
    ("COSRX Snail 96 Mucin Power Essence", "essences-ampoules", "essence"),
    ("Dr. Sheth's Ceramide & Vitamin F Moisturizer", "barrier-care", "ceramide-cream"),
    ("Aroma Magic Cica Cream", "barrier-care", "cica-cream"),
    ("Mamaearth Body Lotion with Vitamin C", "body-skincare", "body-lotion"),
    ("The Body Shop Shea Body Butter", "body-skincare", "body-butter"),
    ("Himalaya Refreshing Body Wash", "body-skincare", "body-wash"),
    ("Khadi Natural Foot Cream", "body-skincare", "foot-cream"),
]


# ============================================================
# COSMETICS — FACE
# ============================================================
COSMETICS_FACE_CASES = [
    ("Lakme 9to5 Primer + Matte Powder Foundation Compact", "face-makeup", "compact"),
    ("Maybelline Fit Me Matte + Poreless Foundation", "face-makeup", "foundation"),
    ("Lakme Absolute White Intense Wet & Dry Compact", "face-makeup", "compact"),
    ("Maybelline Instant Age Rewind Eraser Concealer", "face-makeup", "concealer"),
    ("Lakme Vit-C Superglow Concealer", "face-makeup", "concealer"),
    ("MAC Studio Fix Powder Plus Foundation", "face-makeup", "foundation"),
    ("Sugar Cosmetics Wonder Stick Contour", "face-makeup", "contour"),
    ("Lakme Absolute Sun Kissed Bronzer", "face-makeup", "bronzer"),
    ("Maybelline Master Glitter Highlighter Stick", "face-makeup", "highlighters"),
    ("Lakme Absolute Blur Perfect Makeup Primer", "face-makeup", "face-primer"),
    ("MAC Prep + Prime Fix+ Setting Spray", "face-makeup", "setting-spray"),
    ("Lakme Make-up Remover Wipes", "face-makeup", "makeup-remover"),
    ("Maybelline New York Fit Me Loose Finishing Powder", "face-makeup", "loose-powder"),
    ("Maybelline Cheek Heat Blush", "face-makeup", "blush"),
    ("Maybelline Dream Urban Cover BB Cream", "face-makeup", "bb-cc-cream"),
    ("Lakme 9to5 Primer + Matte Powder Foundation", "face-makeup", "foundation"),
]


# ============================================================
# COSMETICS — LIPS
# ============================================================
COSMETICS_LIP_CASES = [
    ("Lakme Absolute Matte Melt Liquid Lip Color", "lips", "liquid-lipstick"),
    ("Maybelline SuperStay Matte Ink Liquid Lipstick", "lips", "liquid-lipstick"),
    ("Lakme 9to5 Primer + Matte Lipstick Crimson Catwalk", "lips", "lipstick"),
    ("MAC Lustreglass Sheer-Shine Lipstick", "lips", "lipstick"),
    ("Sugar Cosmetics Matte As Hell Crayon Lipstick", "lips", "lip-crayon"),
    ("Maybelline Color Sensational Lip Gloss", "lips", "lip-gloss"),
    ("Maybelline Color Sensational Lip Liner", "lips", "lip-liner"),
    ("Plum Beauty Plump & Shine Lip Plumper", "lips", "lip-plumper"),
    ("Plum Soft-Wear Lip & Cheek Tint", "lips", "lip-tint"),
    ("Lakme 9to5 Lip Primer", "lips", "lip-primer"),
    ("Elle 18 Color Pops Lipstick Pink Rapture", "lips", "lipstick"),
]


# ============================================================
# COSMETICS — EYES
# ============================================================
COSMETICS_EYE_CASES = [
    ("Lakme Eyeconic Kajal", "eyes", "kajal"),
    ("Maybelline Colossal Kohl", "eyes", "kajal"),
    ("Lakme Insta Eye Liner", "eyes", "eyeliner"),
    ("Maybelline Hyper Glossy Liquid Eyeliner", "eyes", "eyeliner"),
    ("Maybelline Lash Sensational Mascara", "eyes", "mascara"),
    ("Lakme Absolute Drama Stylist Eye Shadow Palette", "multi-palettes", "eye-shadow-palette"),
    ("Sugar Cosmetics Stroke of Genius Eyebrow Pencil", "eyes", "eyebrow-enhancers"),
    ("Maybelline Color Tattoo 24hr Eye Primer", "eyes", "eye-primer"),
    ("Ardell False Eyelashes", "eyes", "false-eyelashes"),
    ("Lakme Eye Makeup Remover", "eyes", "eye-makeup-remover"),
]


# ============================================================
# COSMETICS — NAILS
# ============================================================
COSMETICS_NAIL_CASES = [
    ("Lakme 9to5 Primer + Gloss Nail Color Russet Rust", "nails", "nail-polish"),
    ("Maybelline Color Show Nail Lacquer", "nails", "nail-polish"),
    ("Elle 18 Nail Pops Nail Polish", "nails", "nail-polish"),
    ("Lakme Nail Color Remover", "nails", "nail-remover"),
    ("Sally Hansen Nail Strengthener", "nails", "nail-strengthener"),
    ("CND Solar Oil Nail & Cuticle Conditioner", "nails", "cuticle-oil"),
]


# ============================================================
# COSMETICS — TOOLS / PALETTES / KITS
# ============================================================
COSMETICS_TOOLS_CASES = [
    ("Real Techniques Miracle Complexion Beauty Sponge", "tools-brushes", "sponges-applicators"),
    ("Sigma Beauty F80 Flat Kabuki Brush Set", "tools-brushes", "brush-sets"),
    ("Eyelash Curler with Refill Pad", "tools-brushes", "eyelash-curlers"),
    ("Sephora Cosmetics Compact Mirror", "tools-brushes", "mirrors"),
    ("Tweezerman Slant Tweezer", "tools-brushes", "tweezers"),
    ("Urban Decay Naked3 Eyeshadow Palette", "multi-palettes", "eye-shadow-palette"),
    ("Sleek MakeUP Highlighting Palette", "multi-palettes", "cheek-palette"),
    ("Lakme Absolute Bridal Makeup Kit", "makeup-kits", "bridal-kit"),
    ("Maybelline Travel Size Mini Makeup Kit", "makeup-kits", "travel-kit"),
]


# ============================================================
# HAIRCARE (must NOT pollute skincare/cosmetics)
# ============================================================
HAIRCARE_CASES = [
    ("Mamaearth Onion Hair Oil", "haircare", "_skip_sub_"),
    ("L'Oreal Paris Total Repair 5 Shampoo", "haircare", "_skip_sub_"),
    ("Plum Goodness Bring on The Bounce Hair Conditioner", "haircare", "_skip_sub_"),
    ("WOW Skin Science Hair Growth Serum", "haircare", "_skip_sub_"),
]


# ============================================================
# Run all
# ============================================================
ALL_CASES = [
    ("CLEANSERS", CLEANSER_CASES),
    ("EXFOLIATORS", EXFOLIATOR_CASES),
    ("TONERS", TONER_CASES),
    ("SERUMS", SERUM_CASES),
    ("MOISTURIZERS", MOISTURIZER_CASES),
    ("SUNSCREENS", SUNSCREEN_CASES),
    ("MASKS", MASK_CASES),
    ("MISC SKINCARE", MISC_SKINCARE_CASES),
    ("COSMETICS FACE", COSMETICS_FACE_CASES),
    ("COSMETICS LIPS", COSMETICS_LIP_CASES),
    ("COSMETICS EYES", COSMETICS_EYE_CASES),
    ("COSMETICS NAILS", COSMETICS_NAIL_CASES),
    ("COSMETICS TOOLS", COSMETICS_TOOLS_CASES),
    ("HAIRCARE", HAIRCARE_CASES),
]


def run_all():
    total = 0
    failed: list[str] = []
    for group, cases in ALL_CASES:
        print(f"\n=== {group} ===")
        for name, exp_cat, exp_sub in cases:
            total += 1
            r = classify_product(name=name)
            actual_cat = r["category"]
            actual_sub = r["subcategory"]
            actual_niche = r["niche"]
            if exp_cat == "haircare":  # Haircare cases — sub matches anything
                ok = (actual_niche == "haircare")
                tag = "OK" if ok else "FAIL"
                print(f"  [{tag}] {name!r}")
                print(f"        niche={actual_niche}")
                if not ok:
                    failed.append(f"{group}: {name} -> niche={actual_niche}")
            else:
                ok = (actual_cat == exp_cat and actual_sub == exp_sub)
                tag = "OK" if ok else "FAIL"
                print(f"  [{tag}] {name!r}")
                print(f"        expected cat={exp_cat}, sub={exp_sub}")
                print(f"        actual   cat={actual_cat}, sub={actual_sub}, niche={actual_niche}")
                if not ok:
                    failed.append(f"{group}: {name} -> {actual_niche}/{actual_cat}/{actual_sub} (expected {exp_cat}/{exp_sub})")
    print(f"\n========================================")
    print(f"TOTAL: {total} cases | FAILED: {len(failed)} | PASS RATE: {(total - len(failed)) * 100 // total}%")
    if failed:
        print("\nFailed cases:")
        for f in failed:
            print(f"  - {f}")
    return len(failed)


if __name__ == "__main__":
    rc = run_all()
    sys.exit(1 if rc else 0)
