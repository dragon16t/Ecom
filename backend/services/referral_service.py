"""
Referral System Service
- Generate unique referral links
- Track referral purchases
- Calculate earnings
"""
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Dict, Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

class ReferralService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    def generate_referral_code(self, phone: str) -> str:
        """Generate a unique referral code based on phone number"""
        # Create a short unique code using SHA-256 (more secure than MD5)
        hash_input = f"{phone}_{datetime.now().timestamp()}"
        hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:8].upper()
        return f"CG{hash_value}"
    
    async def create_referral(self, order_data: Dict) -> Dict:
        """Create a referral entry after successful order"""
        referral_code = self.generate_referral_code(order_data.get("phone", ""))
        
        referral_doc = {
            "referral_code": referral_code,
            "referrer_phone": order_data.get("phone"),
            "referrer_email": order_data.get("email"),
            "referrer_name": order_data.get("name"),
            "referrer_order_id": order_data.get("order_id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "total_referrals": 0,
            "successful_purchases": 0,
            "total_earnings": 0,
            "earnings_paid": 0,
            "earnings_pending": 0,
            "referred_orders": [],
            "status": "active"
        }
        
        # Check if referral already exists for this phone
        existing = await self.db.referrals.find_one({"referrer_phone": order_data.get("phone")})
        if existing:
            # Return existing referral code
            return {
                "referral_code": existing["referral_code"],
                "referral_link": f"https://celestaglow.com?ref={existing['referral_code']}",
                "is_new": False
            }
        
        await self.db.referrals.insert_one(referral_doc)
        
        return {
            "referral_code": referral_code,
            "referral_link": f"https://celestaglow.com?ref={referral_code}",
            "is_new": True
        }
    
    async def track_referral_click(self, referral_code: str, visitor_id: str = None) -> bool:
        """Track when someone clicks a referral link"""
        referral = await self.db.referrals.find_one({"referral_code": referral_code})
        if not referral:
            return False
        
        await self.db.referrals.update_one(
            {"referral_code": referral_code},
            {
                "$inc": {"total_referrals": 1},
                "$push": {
                    "clicks": {
                        "visitor_id": visitor_id,
                        "clicked_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        return True
    
    async def validate_referral_code(self, referral_code: str) -> Optional[Dict]:
        """Check if a referral code is valid and return referrer info"""
        referral = await self.db.referrals.find_one(
            {"referral_code": referral_code, "status": "active"},
            {"_id": 0, "referral_code": 1, "referrer_name": 1, "referrer_phone": 1}
        )
        return referral
    
    async def record_referral_purchase(self, referral_code: str, order_data: Dict) -> Dict:
        """Record a purchase made through a referral link"""
        referral = await self.db.referrals.find_one({"referral_code": referral_code})
        if not referral:
            return {"success": False, "error": "Invalid referral code"}
        
        # Earnings: ₹100 for each successful referral (paid after delivery)
        earnings_per_referral = 100
        
        referred_order = {
            "order_id": order_data.get("order_id"),
            "buyer_phone": order_data.get("phone"),
            "buyer_name": order_data.get("name"),
            "order_amount": order_data.get("amount"),
            "purchased_at": datetime.now(timezone.utc).isoformat(),
            "referral_discount_applied": 50,  # ₹50 discount for referred user
            "delivery_status": "pending",  # Track delivery for cashback
            "cashback_status": "pending"  # Cashback given after delivery
        }
        
        await self.db.referrals.update_one(
            {"referral_code": referral_code},
            {
                "$inc": {
                    "successful_purchases": 1,
                    "total_earnings": earnings_per_referral,
                    "earnings_pending": earnings_per_referral
                },
                "$push": {"referred_orders": referred_order}
            }
        )
        
        return {
            "success": True,
            "referrer_phone": referral.get("referrer_phone"),
            "referrer_name": referral.get("referrer_name"),
            "earnings_added": earnings_per_referral
        }
    
    async def get_referral_stats(self, phone: str = None, referral_code: str = None) -> Optional[Dict]:
        """Get referral stats for a user"""
        query = {}
        if phone:
            query["referrer_phone"] = phone
        elif referral_code:
            query["referral_code"] = referral_code
        else:
            return None
        
        referral = await self.db.referrals.find_one(query, {"_id": 0})
        return referral
    
    async def get_all_referrals(self, limit: int = 100) -> List[Dict]:
        """Get all referrals for admin panel"""
        referrals = await self.db.referrals.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return referrals
    
    async def get_referral_summary(self) -> Dict:
        """Get summary stats for admin dashboard"""
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total_referrers": {"$sum": 1},
                    "total_clicks": {"$sum": "$total_referrals"},
                    "total_purchases": {"$sum": "$successful_purchases"},
                    "total_earnings": {"$sum": "$total_earnings"},
                    "total_paid": {"$sum": "$earnings_paid"},
                    "total_pending": {"$sum": "$earnings_pending"}
                }
            }
        ]
        
        result = await self.db.referrals.aggregate(pipeline).to_list(1)
        
        if result:
            return {
                "total_referrers": result[0].get("total_referrers", 0),
                "total_clicks": result[0].get("total_clicks", 0),
                "total_purchases": result[0].get("total_purchases", 0),
                "total_earnings": result[0].get("total_earnings", 0),
                "total_paid": result[0].get("total_paid", 0),
                "total_pending": result[0].get("total_pending", 0)
            }
        
        return {
            "total_referrers": 0,
            "total_clicks": 0,
            "total_purchases": 0,
            "total_earnings": 0,
            "total_paid": 0,
            "total_pending": 0
        }
    
    async def mark_earnings_paid(self, referral_code: str, amount: int) -> bool:
        """Mark earnings as paid for a referrer"""
        result = await self.db.referrals.update_one(
            {"referral_code": referral_code},
            {
                "$inc": {
                    "earnings_paid": amount,
                    "earnings_pending": -amount
                },
                "$set": {
                    "last_payment_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return result.modified_count > 0
    
    async def process_delivery_cashback(self, referred_order_id: str) -> Dict:
        """
        Process cashback when a referred order is delivered.
        Called when order status changes to 'Delivered'.
        """
        # Find the referral that has this order in referred_orders
        referral = await self.db.referrals.find_one(
            {"referred_orders.order_id": referred_order_id},
            {"_id": 0}
        )
        
        if not referral:
            return {"success": False, "error": "No referral found for this order"}
        
        # Check if already processed
        for order in referral.get("referred_orders", []):
            if order.get("order_id") == referred_order_id:
                if order.get("delivery_status") == "delivered":
                    return {"success": False, "error": "Already processed"}
                break
        
        # Update the referred order's delivery status
        await self.db.referrals.update_one(
            {"referral_code": referral["referral_code"], "referred_orders.order_id": referred_order_id},
            {
                "$set": {
                    "referred_orders.$.delivery_status": "delivered",
                    "referred_orders.$.delivered_at": datetime.now(timezone.utc).isoformat(),
                    "referred_orders.$.cashback_status": "ready_to_pay"  # ₹100 ready for the referrer
                }
            }
        )
        
        return {
            "success": True,
            "referrer_phone": referral.get("referrer_phone"),
            "referrer_name": referral.get("referrer_name"),
            "referral_code": referral.get("referral_code"),
            "cashback_amount": 100,
            "message": f"₹100 cashback ready for {referral.get('referrer_name')}"
        }
    
    async def get_referral_with_orders(self, referral_code: str) -> Optional[Dict]:
        """Get detailed referral info including all referred orders"""
        referral = await self.db.referrals.find_one(
            {"referral_code": referral_code},
            {"_id": 0}
        )
        return referral
    
    async def mark_order_cashback_paid(self, referral_code: str, order_id: str) -> bool:
        """Mark a specific referred order's cashback as paid"""
        result = await self.db.referrals.update_one(
            {"referral_code": referral_code, "referred_orders.order_id": order_id},
            {
                "$set": {
                    "referred_orders.$.cashback_status": "paid",
                    "referred_orders.$.paid_at": datetime.now(timezone.utc).isoformat()
                },
                "$inc": {
                    "earnings_paid": 100,
                    "earnings_pending": -100
                }
            }
        )
        return result.modified_count > 0
