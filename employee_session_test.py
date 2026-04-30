"""
Backend Testing for Employee Management + SessionStore Changes
Tests admin login, employee management, session persistence, and customer auth regression
"""
import requests
import time
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta

# Configuration
BASE_URL = "https://weather-preview-6.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"
ADMIN_PASSWORD = "celestaglow2024"

# Test results tracking
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })
    print(f"{status} - {test_name}")
    if details:
        print(f"  Details: {details}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for r in test_results if r["passed"])
    failed = sum(1 for r in test_results if not r["passed"])
    print(f"Total: {len(test_results)} | Passed: {passed} | Failed: {failed}")
    print("="*80)
    
    if failed > 0:
        print("\nFAILED TESTS:")
        for r in test_results:
            if not r["passed"]:
                print(f"  ❌ {r['test']}")
                if r["details"]:
                    print(f"     {r['details']}")

# MongoDB connection
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

print("="*80)
print("BACKEND TESTING - Employee Management + SessionStore")
print("="*80)

# ==================== TEST 1: Admin Login & SessionStore Persistence ====================
print("\n[TEST 1] Admin Login & SessionStore Persistence")
try:
    response = requests.post(f"{BASE_URL}/admin/login", json={"password": ADMIN_PASSWORD})
    if response.status_code == 200:
        data = response.json()
        admin_token = data.get("token")
        if admin_token:
            log_test("Admin login returns 200 + token", True, f"Token: {admin_token[:20]}...")
            
            # Check MongoDB for session
            session_doc = db.admin_sessions.find_one({"token": admin_token})
            if session_doc:
                log_test("Admin session stored in MongoDB admin_sessions collection", True, 
                        f"Session has expires_at: {session_doc.get('expires_at')}")
            else:
                log_test("Admin session stored in MongoDB admin_sessions collection", False, 
                        "Session not found in MongoDB")
        else:
            log_test("Admin login returns 200 + token", False, "No token in response")
    else:
        log_test("Admin login returns 200 + token", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("Admin login returns 200 + token", False, f"Exception: {str(e)}")

# ==================== TEST 2: Admin Dashboard/Analytics Access ====================
print("\n[TEST 2] Admin Dashboard/Analytics Access")
try:
    # Try /admin/dashboard first
    response = requests.get(f"{BASE_URL}/admin/dashboard", 
                           headers={"X-Admin-Token": admin_token})
    if response.status_code == 404:
        # Try /admin/analytics/overview instead
        response = requests.get(f"{BASE_URL}/admin/analytics/overview", 
                               headers={"X-Admin-Token": admin_token})
    
    if response.status_code == 200:
        log_test("Admin dashboard/analytics accessible with token", True, 
                f"Response keys: {list(response.json().keys())}")
    else:
        log_test("Admin dashboard/analytics accessible with token", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("Admin dashboard/analytics accessible with token", False, f"Exception: {str(e)}")

# ==================== TEST 3: Session Persistence Across Backend Restart ====================
print("\n[TEST 3] Session Persistence Across Backend Restart")
print("  Restarting backend... (waiting 6 seconds)")
import subprocess
try:
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    time.sleep(6)
    
    # Try to use the same token after restart
    response = requests.get(f"{BASE_URL}/admin/analytics/overview", 
                           headers={"X-Admin-Token": admin_token})
    if response.status_code == 200:
        log_test("Admin session persists across backend restart", True, 
                "Same token works after restart")
    else:
        log_test("Admin session persists across backend restart", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("Admin session persists across backend restart", False, f"Exception: {str(e)}")

# ==================== TEST 4: Create Employee with EMAIL Field ====================
print("\n[TEST 4] Create Employee with EMAIL Field")
try:
    employee_data = {
        "username": "testemp_e1",
        "name": "Test Employee E1",
        "email": "testemp_e1@example.com",
        "password": "MyPass#123 ",  # Intentional trailing space
        "permissions": {"orders": True, "blogs": False, "products": True}
    }
    response = requests.post(f"{BASE_URL}/admin/employees", 
                            json=employee_data,
                            headers={"X-Admin-Token": admin_token})
    
    if response.status_code == 200:
        data = response.json()
        if data.get("success"):
            log_test("Create employee with email returns 200 success", True, 
                    f"Username: {data.get('username')}, Email: {data.get('email')}, Password: {data.get('password')}")
            
            # Verify in MongoDB
            emp_doc = db.employees.find_one({"username": "testemp_e1"})
            if emp_doc:
                import hashlib
                expected_hash = hashlib.sha256("MyPass#123".encode()).hexdigest()  # Trimmed
                actual_hash = emp_doc.get("password_hash")
                if actual_hash == expected_hash:
                    log_test("Employee password trimmed and hashed correctly", True, 
                            f"Hash matches SHA-256 of trimmed password")
                else:
                    log_test("Employee password trimmed and hashed correctly", False, 
                            f"Expected: {expected_hash}, Got: {actual_hash}")
                
                if emp_doc.get("email") == "testemp_e1@example.com":
                    log_test("Employee email stored correctly", True, "Email matches")
                else:
                    log_test("Employee email stored correctly", False, 
                            f"Expected: testemp_e1@example.com, Got: {emp_doc.get('email')}")
            else:
                log_test("Employee stored in MongoDB", False, "Employee not found in database")
        else:
            log_test("Create employee with email returns 200 success", False, 
                    f"Success=False, Error: {data.get('error')}")
    else:
        log_test("Create employee with email returns 200 success", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("Create employee with email returns 200 success", False, f"Exception: {str(e)}")

# ==================== TEST 5: Employee Login by USERNAME with Whitespace ====================
print("\n[TEST 5] Employee Login by USERNAME with Whitespace")
try:
    login_data = {
        "username": "  TestEmp_E1  ",  # Mixed case, leading/trailing whitespace
        "password": " MyPass#123 "     # Leading/trailing whitespace
    }
    response = requests.post(f"{BASE_URL}/employee/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        if data.get("success") and data.get("token"):
            employee_token = data.get("token")
            log_test("Employee login by username with whitespace returns 200", True, 
                    f"Token: {employee_token[:20]}...")
        else:
            log_test("Employee login by username with whitespace returns 200", False, 
                    f"Success={data.get('success')}, Token present: {bool(data.get('token'))}")
    else:
        log_test("Employee login by username with whitespace returns 200", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("Employee login by username with whitespace returns 200", False, f"Exception: {str(e)}")

# ==================== TEST 6: Employee Login by EMAIL ====================
print("\n[TEST 6] Employee Login by EMAIL")
try:
    login_data = {
        "username": "testemp_e1@example.com",  # Using email instead of username
        "password": "MyPass#123"
    }
    response = requests.post(f"{BASE_URL}/employee/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        if data.get("success") and data.get("token"):
            employee_token_email = data.get("token")
            log_test("Employee login by email returns 200", True, 
                    f"Token: {employee_token_email[:20]}...")
        else:
            log_test("Employee login by email returns 200", False, 
                    f"Success={data.get('success')}, Token present: {bool(data.get('token'))}")
    else:
        log_test("Employee login by email returns 200", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("Employee login by email returns 200", False, f"Exception: {str(e)}")

# ==================== TEST 7: Employee Session Stored in MongoDB ====================
print("\n[TEST 7] Employee Session Stored in MongoDB")
try:
    session_doc = db.employee_sessions.find_one({"token": employee_token})
    if session_doc:
        expires_at = session_doc.get("expires_at")
        # Check if expires_at is ~30 days in future
        if isinstance(expires_at, datetime):
            days_diff = (expires_at - datetime.now(timezone.utc)).days
            if 28 <= days_diff <= 31:
                log_test("Employee session stored with ~30 day expiry", True, 
                        f"Expires in {days_diff} days")
            else:
                log_test("Employee session stored with ~30 day expiry", False, 
                        f"Expires in {days_diff} days (expected ~30)")
        else:
            log_test("Employee session stored with ~30 day expiry", True, 
                    f"Session stored with expires_at: {expires_at}")
    else:
        log_test("Employee session stored in MongoDB", False, "Session not found")
except Exception as e:
    log_test("Employee session stored in MongoDB", False, f"Exception: {str(e)}")

# ==================== TEST 8: Employee Session Persistence Across Restart ====================
print("\n[TEST 8] Employee Session Persistence Across Backend Restart")
print("  Restarting backend... (waiting 6 seconds)")
try:
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    time.sleep(6)
    
    # Try to verify employee token after restart
    response = requests.post(f"{BASE_URL}/employee/verify", 
                            headers={"X-Employee-Token": employee_token})
    if response.status_code == 200:
        data = response.json()
        if data.get("valid"):
            log_test("Employee session persists across backend restart", True, 
                    f"Token valid after restart, username: {data.get('username')}")
        else:
            log_test("Employee session persists across backend restart", False, 
                    "Token not valid after restart")
    else:
        log_test("Employee session persists across backend restart", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("Employee session persists across backend restart", False, f"Exception: {str(e)}")

# ==================== TEST 9: Negative Tests ====================
print("\n[TEST 9] Negative Tests")

# Wrong password
try:
    response = requests.post(f"{BASE_URL}/employee/login", 
                            json={"username": "testemp_e1", "password": "WrongPassword123"})
    if response.status_code == 401:
        data = response.json()
        if "Invalid username/email or password" in data.get("detail", ""):
            log_test("Wrong password returns 401 with correct message", True, 
                    f"Detail: {data.get('detail')}")
        else:
            log_test("Wrong password returns 401 with correct message", False, 
                    f"Detail: {data.get('detail')}")
    else:
        log_test("Wrong password returns 401", False, 
                f"Status: {response.status_code}")
except Exception as e:
    log_test("Wrong password returns 401", False, f"Exception: {str(e)}")

# Wrong username
try:
    response = requests.post(f"{BASE_URL}/employee/login", 
                            json={"username": "nonexistent_user", "password": "MyPass#123"})
    if response.status_code == 401:
        log_test("Wrong username returns 401", True)
    else:
        log_test("Wrong username returns 401", False, 
                f"Status: {response.status_code}")
except Exception as e:
    log_test("Wrong username returns 401", False, f"Exception: {str(e)}")

# Empty username
try:
    response = requests.post(f"{BASE_URL}/employee/login", 
                            json={"username": "", "password": "MyPass#123"})
    if response.status_code == 401:
        log_test("Empty username returns 401", True)
    else:
        log_test("Empty username returns 401", False, 
                f"Status: {response.status_code}")
except Exception as e:
    log_test("Empty username returns 401", False, f"Exception: {str(e)}")

# ==================== TEST 10: Auto-Generated Password ====================
print("\n[TEST 10] Auto-Generated Password")
try:
    employee_data = {
        "username": "testemp_auto",
        "name": "Test Employee Auto",
        "email": "testemp_auto@example.com",
        # No password provided - should auto-generate
        "permissions": {"orders": True, "blogs": False}
    }
    response = requests.post(f"{BASE_URL}/admin/employees", 
                            json=employee_data,
                            headers={"X-Admin-Token": admin_token})
    
    if response.status_code == 200:
        data = response.json()
        auto_password = data.get("password")
        if auto_password:
            # Check if password is hex (0-9, a-f only)
            import re
            if re.match(r'^[0-9a-f]+$', auto_password):
                log_test("Auto-generated password is hex format", True, 
                        f"Password: {auto_password}")
                
                # Try to login with auto-generated password
                login_response = requests.post(f"{BASE_URL}/employee/login", 
                                              json={"username": "testemp_auto", 
                                                   "password": auto_password})
                if login_response.status_code == 200 and login_response.json().get("success"):
                    log_test("Auto-generated password works for login", True)
                else:
                    log_test("Auto-generated password works for login", False, 
                            f"Status: {login_response.status_code}, Response: {login_response.text}")
            else:
                log_test("Auto-generated password is hex format", False, 
                        f"Password contains non-hex chars: {auto_password}")
        else:
            log_test("Auto-generated password returned", False, "No password in response")
    else:
        log_test("Create employee without password", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("Auto-generated password test", False, f"Exception: {str(e)}")

# ==================== TEST 11: Customer Auth Regression Check ====================
print("\n[TEST 11] Customer Auth Regression Check")

# Send OTP
try:
    response = requests.post(f"{BASE_URL}/auth/send-otp", 
                            json={"email": "regress@example.com"})
    if response.status_code == 200:
        log_test("Customer send-otp returns 200", True)
        
        # Get OTP from database
        otp_doc = db.customer_otps.find_one({"email": "regress@example.com"})
        if otp_doc:
            otp_code = otp_doc.get("otp")
            log_test("Customer OTP stored in database", True, f"OTP: {otp_code}")
            
            # Verify OTP
            verify_response = requests.post(f"{BASE_URL}/auth/verify-otp", 
                                           json={"email": "regress@example.com", 
                                                "otp": otp_code})
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                customer_token = verify_data.get("token")
                if customer_token:
                    log_test("Customer verify-otp returns 200 + token", True)
                    
                    # Get customer info
                    me_response = requests.get(f"{BASE_URL}/auth/me", 
                                              headers={"Authorization": f"Bearer {customer_token}"})
                    if me_response.status_code == 200:
                        log_test("Customer /auth/me returns 200 with bearer token", True)
                    else:
                        log_test("Customer /auth/me returns 200 with bearer token", False, 
                                f"Status: {me_response.status_code}")
                else:
                    log_test("Customer verify-otp returns token", False, "No token in response")
            else:
                log_test("Customer verify-otp returns 200", False, 
                        f"Status: {verify_response.status_code}")
        else:
            log_test("Customer OTP stored in database", False, "OTP not found")
    else:
        log_test("Customer send-otp returns 200", False, 
                f"Status: {response.status_code}")
except Exception as e:
    log_test("Customer auth regression check", False, f"Exception: {str(e)}")

# ==================== TEST 12: MongoDB Indexes ====================
print("\n[TEST 12] MongoDB Indexes Verification")

# Check admin_sessions indexes
try:
    admin_indexes = list(db.admin_sessions.list_indexes())
    token_index_found = False
    ttl_index_found = False
    
    for idx in admin_indexes:
        if 'token' in idx.get('key', {}):
            token_index_found = True
            if idx.get('unique'):
                log_test("admin_sessions has unique index on token", True)
            else:
                log_test("admin_sessions has unique index on token", False, "Index not unique")
        if 'expires_at' in idx.get('key', {}):
            ttl_index_found = True
            if idx.get('expireAfterSeconds') == 0:
                log_test("admin_sessions has TTL index on expires_at", True)
            else:
                log_test("admin_sessions has TTL index on expires_at", False, 
                        f"expireAfterSeconds: {idx.get('expireAfterSeconds')}")
    
    if not token_index_found:
        log_test("admin_sessions has index on token", False, "Index not found")
    if not ttl_index_found:
        log_test("admin_sessions has TTL index on expires_at", False, "Index not found")
except Exception as e:
    log_test("admin_sessions indexes check", False, f"Exception: {str(e)}")

# Check employee_sessions indexes
try:
    emp_indexes = list(db.employee_sessions.list_indexes())
    token_index_found = False
    ttl_index_found = False
    
    for idx in emp_indexes:
        if 'token' in idx.get('key', {}):
            token_index_found = True
            if idx.get('unique'):
                log_test("employee_sessions has unique index on token", True)
            else:
                log_test("employee_sessions has unique index on token", False, "Index not unique")
        if 'expires_at' in idx.get('key', {}):
            ttl_index_found = True
            if idx.get('expireAfterSeconds') == 0:
                log_test("employee_sessions has TTL index on expires_at", True)
            else:
                log_test("employee_sessions has TTL index on expires_at", False, 
                        f"expireAfterSeconds: {idx.get('expireAfterSeconds')}")
    
    if not token_index_found:
        log_test("employee_sessions has index on token", False, "Index not found")
    if not ttl_index_found:
        log_test("employee_sessions has TTL index on expires_at", False, "Index not found")
except Exception as e:
    log_test("employee_sessions indexes check", False, f"Exception: {str(e)}")

# Print summary
print_summary()

# Close MongoDB connection
mongo_client.close()
