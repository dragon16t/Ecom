#!/usr/bin/env python3
"""
Backend API Testing for Customer Auth & Orders
Tests all customer authentication and order endpoints
"""
import os
import sys
import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

# Configuration
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://weather-preview-6.preview.emergentagent.com")
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# Test data
TEST_EMAIL = "testuser_e1@example.com"
TEST_PHONE = "9876543210"
TEST_NAME = "Test User"

# Global variables to store test state
test_otp = None
test_token = None
test_order_id = None
test_customer_id = None

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def print_test(test_name):
    """Print test name"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST: {test_name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")


def print_success(message):
    """Print success message"""
    print(f"{GREEN}✓ {message}{RESET}")


def print_error(message):
    """Print error message"""
    print(f"{RED}✗ {message}{RESET}")


def print_info(message):
    """Print info message"""
    print(f"{YELLOW}ℹ {message}{RESET}")


async def test_1_send_otp():
    """Test 1: POST /api/auth/send-otp"""
    global test_otp
    print_test("1. POST /api/auth/send-otp")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/auth/send-otp",
                json={"email": TEST_EMAIL}
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if not data.get("success"):
                print_error("Response success is not True")
                return False
            
            if data.get("email") != TEST_EMAIL:
                print_error(f"Email mismatch: expected {TEST_EMAIL}, got {data.get('email')}")
                return False
            
            # delivered can be True or False (False is acceptable when SMTP not configured)
            delivered = data.get("delivered")
            print_info(f"Email delivered: {delivered}")
            
            # Now check MongoDB for the OTP
            mongo_client = AsyncIOMotorClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            otp_record = await db.customer_otps.find_one({"email": TEST_EMAIL})
            if not otp_record:
                print_error("OTP record not found in MongoDB customer_otps collection")
                mongo_client.close()
                return False
            
            test_otp = str(otp_record.get("otp"))
            print_info(f"OTP from DB: {test_otp}")
            
            if not test_otp or len(test_otp) != 6:
                print_error(f"Invalid OTP format: {test_otp}")
                mongo_client.close()
                return False
            
            # Check expires_at is ~10 minutes in future
            expires_at = otp_record.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            elif isinstance(expires_at, datetime) and expires_at.tzinfo is None:
                # Make timezone-naive datetime from MongoDB timezone-aware
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            now = datetime.now(timezone.utc)
            time_diff = (expires_at - now).total_seconds() / 60
            
            if time_diff < 9 or time_diff > 11:
                print_error(f"OTP expiry time is not ~10 minutes: {time_diff:.1f} minutes")
                mongo_client.close()
                return False
            
            print_success(f"OTP sent successfully and stored in DB (expires in {time_diff:.1f} min)")
            mongo_client.close()
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_2_verify_otp_happy_path():
    """Test 2: POST /api/auth/verify-otp (HAPPY PATH)"""
    global test_token, test_customer_id
    print_test("2. POST /api/auth/verify-otp (HAPPY PATH)")
    
    if not test_otp:
        print_error("No OTP available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/auth/verify-otp",
                json={
                    "email": TEST_EMAIL,
                    "otp": test_otp,
                    "phone": TEST_PHONE,
                    "name": TEST_NAME
                }
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if not data.get("success"):
                print_error("Response success is not True")
                return False
            
            test_token = data.get("token")
            if not test_token or len(test_token) < 32:
                print_error(f"Invalid token: {test_token}")
                return False
            
            user = data.get("user")
            if not user:
                print_error("No user object in response")
                return False
            
            test_customer_id = user.get("customer_id")
            if not test_customer_id:
                print_error("No customer_id in user object")
                return False
            
            if user.get("email") != TEST_EMAIL:
                print_error(f"Email mismatch: expected {TEST_EMAIL}, got {user.get('email')}")
                return False
            
            if user.get("phone") != TEST_PHONE:
                print_error(f"Phone mismatch: expected {TEST_PHONE}, got {user.get('phone')}")
                return False
            
            if user.get("name") != TEST_NAME:
                print_error(f"Name mismatch: expected {TEST_NAME}, got {user.get('name')}")
                return False
            
            # Verify customer record in MongoDB
            mongo_client = AsyncIOMotorClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            customer = await db.customers.find_one({"email": TEST_EMAIL})
            if not customer:
                print_error("Customer record not found in MongoDB customers collection")
                mongo_client.close()
                return False
            
            print_info(f"Customer ID: {customer.get('customer_id')}")
            
            # Verify session record in MongoDB
            session = await db.customer_sessions.find_one({"token": test_token})
            if not session:
                print_error("Session record not found in MongoDB customer_sessions collection")
                mongo_client.close()
                return False
            
            print_info(f"Session email: {session.get('email')}")
            
            print_success(f"OTP verified successfully, token: {test_token[:20]}...")
            mongo_client.close()
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_3_verify_otp_wrong_otp():
    """Test 3: POST /api/auth/verify-otp (WRONG OTP)"""
    print_test("3. POST /api/auth/verify-otp (WRONG OTP)")
    
    # First send a new OTP
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{API_BASE}/auth/send-otp",
                json={"email": "wrong_otp_test@example.com"}
            )
            
            # Try with wrong OTP
            response = await client.post(
                f"{API_BASE}/auth/verify-otp",
                json={
                    "email": "wrong_otp_test@example.com",
                    "otp": "999999",
                    "phone": TEST_PHONE,
                    "name": TEST_NAME
                }
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 400:
                print_error(f"Expected 400, got {response.status_code}")
                return False
            
            data = response.json()
            detail = data.get("detail", "").lower()
            if "incorrect" not in detail and "otp" not in detail:
                print_error(f"Expected 'Incorrect OTP' message, got: {data.get('detail')}")
                return False
            
            print_success("Wrong OTP correctly rejected with 400")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_4_verify_otp_expired():
    """Test 4: POST /api/auth/verify-otp (EXPIRED OTP)"""
    print_test("4. POST /api/auth/verify-otp (EXPIRED OTP)")
    
    try:
        # Create an expired OTP directly in MongoDB
        mongo_client = AsyncIOMotorClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        
        expired_email = "expired_otp_test@example.com"
        past_time = datetime.now(timezone.utc) - timedelta(minutes=1)
        
        await db.customer_otps.update_one(
            {"email": expired_email},
            {"$set": {
                "email": expired_email,
                "otp": "123456",
                "expires_at": past_time,
                "created_at": datetime.now(timezone.utc),
                "attempts": 0,
            }},
            upsert=True
        )
        
        mongo_client.close()
        
        # Try to verify expired OTP
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/auth/verify-otp",
                json={
                    "email": expired_email,
                    "otp": "123456",
                    "phone": TEST_PHONE,
                    "name": TEST_NAME
                }
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 400:
                print_error(f"Expected 400, got {response.status_code}")
                return False
            
            data = response.json()
            detail = data.get("detail", "").lower()
            if "expired" not in detail:
                print_error(f"Expected 'OTP expired' message, got: {data.get('detail')}")
                return False
            
            print_success("Expired OTP correctly rejected with 400")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_5_verify_otp_no_otp():
    """Test 5: POST /api/auth/verify-otp (NO OTP ISSUED)"""
    print_test("5. POST /api/auth/verify-otp (NO OTP ISSUED)")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/auth/verify-otp",
                json={
                    "email": "no_otp_issued@example.com",
                    "otp": "123456",
                    "phone": TEST_PHONE,
                    "name": TEST_NAME
                }
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 400:
                print_error(f"Expected 400, got {response.status_code}")
                return False
            
            data = response.json()
            detail = data.get("detail", "").lower()
            if "no otp" not in detail:
                print_error(f"Expected 'No OTP found' message, got: {data.get('detail')}")
                return False
            
            print_success("No OTP case correctly rejected with 400")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_6_get_me_with_token():
    """Test 6: GET /api/auth/me with bearer token"""
    print_test("6. GET /api/auth/me with bearer token")
    
    if not test_token:
        print_error("No token available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/auth/me",
                headers={"Authorization": f"Bearer {test_token}"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            user = data.get("user")
            if not user:
                print_error("No user object in response")
                return False
            
            if user.get("email") != TEST_EMAIL:
                print_error(f"Email mismatch: expected {TEST_EMAIL}, got {user.get('email')}")
                return False
            
            if user.get("phone") != TEST_PHONE:
                print_error(f"Phone mismatch: expected {TEST_PHONE}, got {user.get('phone')}")
                return False
            
            if user.get("customer_id") != test_customer_id:
                print_error(f"Customer ID mismatch: expected {test_customer_id}, got {user.get('customer_id')}")
                return False
            
            print_success("GET /api/auth/me returned correct user data")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_7_get_me_without_token():
    """Test 7: GET /api/auth/me without bearer token"""
    print_test("7. GET /api/auth/me without bearer token")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{API_BASE}/auth/me")
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code != 401:
                print_error(f"Expected 401, got {response.status_code}")
                return False
            
            print_success("GET /api/auth/me without token correctly returned 401")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_8_get_me_invalid_token():
    """Test 8: GET /api/auth/me with invalid bearer token"""
    print_test("8. GET /api/auth/me with invalid bearer token")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/auth/me",
                headers={"Authorization": "Bearer invalid_token_12345"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code != 401:
                print_error(f"Expected 401, got {response.status_code}")
                return False
            
            print_success("GET /api/auth/me with invalid token correctly returned 401")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_9_get_orders_empty():
    """Test 9: GET /api/auth/orders (should be empty before placing order)"""
    print_test("9. GET /api/auth/orders (empty)")
    
    if not test_token:
        print_error("No token available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/auth/orders",
                headers={"Authorization": f"Bearer {test_token}"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if not data.get("success"):
                print_error("Response success is not True")
                return False
            
            orders = data.get("orders", [])
            count = data.get("count", 0)
            
            # Note: There might be existing orders from previous tests
            print_info(f"Found {count} existing orders")
            print_success(f"GET /api/auth/orders returned successfully with {count} orders")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_10_create_order():
    """Test 10: POST /api/orders (create an order)"""
    global test_order_id
    print_test("10. POST /api/orders")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/orders",
                json={
                    "name": TEST_NAME,
                    "phone": TEST_PHONE,
                    "email": TEST_EMAIL,
                    "house_number": "12",
                    "area": "Test Street",
                    "pincode": "560001",
                    "state": "Karnataka",
                    "payment_method": "cod",
                    "amount": 999,
                    "items": [{
                        "slug": "anti-aging-serum",
                        "name": "Anti-Aging Serum",
                        "quantity": 1,
                        "price": 999
                    }]
                }
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            test_order_id = data.get("order_id")
            
            if not test_order_id or not test_order_id.startswith("CG"):
                print_error(f"Invalid order_id format: {test_order_id}")
                return False
            
            print_success(f"Order created successfully: {test_order_id}")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_11_get_orders_with_order():
    """Test 11: GET /api/auth/orders (should now return the order)"""
    print_test("11. GET /api/auth/orders (with order)")
    
    if not test_token:
        print_error("No token available from previous test")
        return False
    
    if not test_order_id:
        print_error("No order_id available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/auth/orders",
                headers={"Authorization": f"Bearer {test_token}"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if not data.get("success"):
                print_error("Response success is not True")
                return False
            
            orders = data.get("orders", [])
            count = data.get("count", 0)
            
            if count == 0:
                print_error("No orders returned")
                return False
            
            # Find our test order
            found = False
            for order in orders:
                if order.get("order_id") == test_order_id:
                    found = True
                    print_info(f"Order found: {order.get('order_id')}")
                    print_info(f"Status: {order.get('status')}")
                    print_info(f"Total amount: {order.get('total_amount')}")
                    print_info(f"Payment method: {order.get('payment_method')}")
                    print_info(f"Items: {order.get('items')}")
                    print_info(f"Tracking URL: {order.get('tracking_url')}")
                    print_info(f"Delivery timeline: {order.get('delivery_timeline')}")
                    
                    # Verify required fields
                    if not order.get("order_id"):
                        print_error("Missing order_id")
                        return False
                    if not order.get("status"):
                        print_error("Missing status")
                        return False
                    if order.get("total_amount") is None:
                        print_error("Missing total_amount")
                        return False
                    if not order.get("payment_method"):
                        print_error("Missing payment_method")
                        return False
                    if not order.get("items"):
                        print_error("Missing items")
                        return False
                    if not order.get("delivery_timeline"):
                        print_error("Missing delivery_timeline")
                        return False
                    
                    break
            
            if not found:
                print_error(f"Order {test_order_id} not found in response")
                return False
            
            print_success(f"GET /api/auth/orders returned the created order")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_12_track_order_by_email():
    """Test 12: POST /api/track-order with EMAIL"""
    print_test("12. POST /api/track-order with EMAIL")
    
    if not test_order_id:
        print_error("No order_id available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/track-order",
                json={"email": TEST_EMAIL}
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if not data.get("success"):
                print_error("Response success is not True")
                return False
            
            orders = data.get("orders", [])
            count = data.get("count", 0)
            
            if count == 0:
                print_error("No orders returned")
                return False
            
            # Find our test order
            found = False
            for order in orders:
                if order.get("order_id") == test_order_id:
                    found = True
                    print_info(f"Order found: {order.get('order_id')}")
                    break
            
            if not found:
                print_error(f"Order {test_order_id} not found in track-order response")
                return False
            
            print_success(f"POST /api/track-order with email returned the order")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_13_track_order_by_phone():
    """Test 13: POST /api/track-order with PHONE"""
    print_test("13. POST /api/track-order with PHONE")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/track-order",
                json={"phone": TEST_PHONE}
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            # Response shape may be Delhivery-flavoured, just check for success
            data = response.json()
            print_info(f"Track by phone response: {data}")
            
            print_success("POST /api/track-order with phone returned 200")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_14_save_cart():
    """Test 14: POST /api/auth/cart (save cart)"""
    print_test("14. POST /api/auth/cart (save cart)")
    
    if not test_token:
        print_error("No token available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/auth/cart",
                headers={"Authorization": f"Bearer {test_token}"},
                json={
                    "items": [
                        {"slug": "anti-aging-serum", "quantity": 2},
                        {"slug": "sunscreen", "quantity": 1}
                    ]
                }
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if not data.get("success"):
                print_error("Response success is not True")
                return False
            
            if data.get("count") != 2:
                print_error(f"Expected count 2, got {data.get('count')}")
                return False
            
            print_success("Cart saved successfully with 2 items")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_15_get_cart():
    """Test 15: GET /api/auth/cart (load cart)"""
    print_test("15. GET /api/auth/cart (load cart)")
    
    if not test_token:
        print_error("No token available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/auth/cart",
                headers={"Authorization": f"Bearer {test_token}"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if not data.get("success"):
                print_error("Response success is not True")
                return False
            
            items = data.get("items", [])
            if len(items) != 2:
                print_error(f"Expected 2 items, got {len(items)}")
                return False
            
            # Verify items match what we saved
            slugs = [item.get("slug") for item in items]
            if "anti-aging-serum" not in slugs or "sunscreen" not in slugs:
                print_error(f"Cart items don't match: {slugs}")
                return False
            
            print_success("Cart loaded successfully with correct items")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_16_logout():
    """Test 16: POST /api/auth/logout"""
    print_test("16. POST /api/auth/logout")
    
    if not test_token:
        print_error("No token available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE}/auth/logout",
                headers={"Authorization": f"Bearer {test_token}"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Response: {response.json()}")
            
            if response.status_code != 200:
                print_error(f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if not data.get("success"):
                print_error("Response success is not True")
                return False
            
            print_success("Logout successful")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def test_17_get_me_after_logout():
    """Test 17: GET /api/auth/me after logout (should return 401)"""
    print_test("17. GET /api/auth/me after logout")
    
    if not test_token:
        print_error("No token available from previous test")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/auth/me",
                headers={"Authorization": f"Bearer {test_token}"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code != 401:
                print_error(f"Expected 401 after logout, got {response.status_code}")
                return False
            
            print_success("GET /api/auth/me after logout correctly returned 401")
            return True
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def verify_mongodb_collections():
    """Verify MongoDB collections are properly populated"""
    print_test("MongoDB Collections Verification")
    
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        
        # Check customer_otps
        otp_count = await db.customer_otps.count_documents({})
        print_info(f"customer_otps collection: {otp_count} documents")
        
        # Check customers
        customer_count = await db.customers.count_documents({})
        print_info(f"customers collection: {customer_count} documents")
        
        customer = await db.customers.find_one({"email": TEST_EMAIL})
        if customer:
            print_info(f"Test customer found: {customer.get('customer_id')}")
        
        # Check customer_sessions
        session_count = await db.customer_sessions.count_documents({})
        print_info(f"customer_sessions collection: {session_count} documents")
        
        # Check customer_carts
        cart_count = await db.customer_carts.count_documents({})
        print_info(f"customer_carts collection: {cart_count} documents")
        
        cart = await db.customer_carts.find_one({"email": TEST_EMAIL})
        if cart:
            print_info(f"Test cart found with {len(cart.get('items', []))} items")
        
        # Check orders
        order_count = await db.orders.count_documents({})
        print_info(f"orders collection: {order_count} documents")
        
        if test_order_id:
            order = await db.orders.find_one({"order_id": test_order_id})
            if order:
                print_info(f"Test order found: {order.get('order_id')}")
        
        mongo_client.close()
        print_success("MongoDB collections verified")
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


async def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}BACKEND API TESTING - Customer Auth & Orders{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print_info(f"Backend URL: {BACKEND_URL}")
    print_info(f"API Base: {API_BASE}")
    print_info(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print_info(f"Test Email: {TEST_EMAIL}")
    print_info(f"Test Phone: {TEST_PHONE}")
    
    results = {}
    
    # Run tests in order
    tests = [
        ("1. Send OTP", test_1_send_otp),
        ("2. Verify OTP (Happy Path)", test_2_verify_otp_happy_path),
        ("3. Verify OTP (Wrong OTP)", test_3_verify_otp_wrong_otp),
        ("4. Verify OTP (Expired)", test_4_verify_otp_expired),
        ("5. Verify OTP (No OTP)", test_5_verify_otp_no_otp),
        ("6. Get Me (With Token)", test_6_get_me_with_token),
        ("7. Get Me (Without Token)", test_7_get_me_without_token),
        ("8. Get Me (Invalid Token)", test_8_get_me_invalid_token),
        ("9. Get Orders (Empty)", test_9_get_orders_empty),
        ("10. Create Order", test_10_create_order),
        ("11. Get Orders (With Order)", test_11_get_orders_with_order),
        ("12. Track Order (Email)", test_12_track_order_by_email),
        ("13. Track Order (Phone)", test_13_track_order_by_phone),
        ("14. Save Cart", test_14_save_cart),
        ("15. Get Cart", test_15_get_cart),
        ("16. Logout", test_16_logout),
        ("17. Get Me After Logout", test_17_get_me_after_logout),
        ("MongoDB Verification", verify_mongodb_collections),
    ]
    
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results[test_name] = result
        except Exception as e:
            print_error(f"Test {test_name} crashed: {str(e)}")
            results[test_name] = False
    
    # Print summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    passed = sum(1 for r in results.values() if r)
    failed = sum(1 for r in results.values() if not r)
    
    for test_name, result in results.items():
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{status} - {test_name}")
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"Total: {len(results)} | {GREEN}Passed: {passed}{RESET} | {RED}Failed: {failed}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
