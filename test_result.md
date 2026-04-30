#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Test the new customer email-OTP authentication and orders endpoints at https://weather-preview-6.preview.emergentagent.com/api"

backend:
  - task: "POST /api/auth/send-otp - Send OTP to email"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - OTP sent successfully to testuser_e1@example.com. Email delivered: True. OTP stored in MongoDB customer_otps collection with 6-digit code (481615) and expires_at ~10 minutes in future. Response: {'success': True, 'email': 'testuser_e1@example.com', 'delivered': True}"

  - task: "POST /api/auth/verify-otp - Verify OTP and create session (Happy Path)"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "testing"
        comment: "❌ CRITICAL BUG FOUND - TypeError: can't compare offset-naive and offset-aware datetimes at line 170. The expires_at datetime from MongoDB is timezone-naive but being compared with timezone-aware datetime.now(timezone.utc)"
      - working: true
        agent: "testing"
        comment: "✅ FIXED & PASS - Added timezone handling for MongoDB datetime objects. Now correctly handles both string and datetime objects from MongoDB by making them timezone-aware before comparison. OTP verified successfully, token generated (6UEO5R9s3_smhZXdmo38...), customer record created in customers collection (CUST56EC5EEF), session created in customer_sessions collection. Response includes token, expires_at, and user object with customer_id, email, phone, name."

  - task: "POST /api/auth/verify-otp - Wrong OTP rejection"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - Wrong OTP correctly rejected with 400 status code and error message 'Incorrect OTP. Please try again.'"

  - task: "POST /api/auth/verify-otp - Expired OTP rejection"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - Expired OTP correctly rejected with 400 status code and error message 'OTP expired. Please request a new code.'"

  - task: "POST /api/auth/verify-otp - No OTP issued rejection"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - No OTP case correctly rejected with 400 status code and error message 'No OTP found for this email. Please request a new code.'"

  - task: "GET /api/auth/me - Get current user with bearer token"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - GET /api/auth/me with valid bearer token returns 200 with correct user object containing customer_id, email, phone, name. All fields match expected values."

  - task: "GET /api/auth/me - Reject without bearer token"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - GET /api/auth/me without bearer token correctly returns 401 Unauthorized."

  - task: "GET /api/auth/me - Reject with invalid bearer token"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - GET /api/auth/me with invalid bearer token correctly returns 401 Unauthorized."

  - task: "GET /api/auth/orders - Get orders for logged-in user"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - GET /api/auth/orders with bearer token returns 200 with orders array. Returns orders matching user's email or phone. Response includes success: true, orders array with order_id, status, total_amount, payment_method, created_at, items, awb_number, tracking_url, delivery_timeline. Count field shows number of orders."

  - task: "POST /api/orders - Create order"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - POST /api/orders successfully creates order with all required fields. Order ID format CG###### generated correctly. Response includes order_id, name, phone, email, house_number, area, pincode, state, payment_method, amount, delivery_timeline, status, created_at, items, referral_code, referral_link. Order stored in MongoDB orders collection."

  - task: "POST /api/track-order - Track order by email"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - POST /api/track-order with email returns 200 with success: true, orders array containing all orders for that email. Each order includes order_id, status, total_amount, payment_method, created_at, items, awb_number, tracking_url, delivery_timeline. Count field shows number of orders."

  - task: "POST /api/track-order - Track order by phone (legacy)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - POST /api/track-order with phone returns 200 with success: true. Response is Delhivery-flavoured with orders array and total_orders count. Legacy phone tracking path still works correctly."

  - task: "POST /api/auth/cart - Save cart for logged-in user"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - POST /api/auth/cart with bearer token and items array successfully saves cart. Response: {'success': True, 'count': 2}. Cart stored in MongoDB customer_carts collection with email, items, and updated_at."

  - task: "GET /api/auth/cart - Load cart for logged-in user"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - GET /api/auth/cart with bearer token returns 200 with success: true and items array. Items match what was saved (anti-aging-serum qty 2, sunscreen qty 1). Cart correctly loaded from MongoDB."

  - task: "POST /api/auth/logout - Logout and invalidate session"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - POST /api/auth/logout with bearer token returns 200 with success: true. Session token deleted from customer_sessions collection. Subsequent requests with same token correctly return 401."

  - task: "MongoDB Collections - Verify data persistence"
    implemented: true
    working: true
    file: "/app/backend/routes/customer_auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PASS - All MongoDB collections verified: customer_otps (3 docs), customers (1 doc with test customer CUST56EC5EEF), customer_sessions (0 docs after logout), customer_carts (1 doc with 2 items), orders (4 docs including test orders). All collections being written correctly."

frontend:
  # No frontend testing required for this task

metadata:
  created_by: "testing_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false
  last_updated: "2026-04-30T15:11:00Z"

test_plan:
  current_focus:
    - "All customer auth and order endpoints tested"
  stuck_tasks: []
  test_all: false
  test_priority: "sequential"

agent_communication:
  - agent: "testing"
    message: "Comprehensive backend testing completed for customer email-OTP authentication and orders endpoints. Found and fixed 1 CRITICAL bug in datetime comparison. All 18 test scenarios now passing. Details: (1) Send OTP - PASS, (2) Verify OTP happy path - FIXED & PASS, (3) Wrong OTP - PASS, (4) Expired OTP - PASS, (5) No OTP - PASS, (6) Get me with token - PASS, (7) Get me without token - PASS, (8) Get me invalid token - PASS, (9) Get orders - PASS, (10) Create order - PASS, (11) Get orders with order - PASS, (12) Track by email - PASS, (13) Track by phone - PASS, (14) Save cart - PASS, (15) Get cart - PASS, (16) Logout - PASS, (17) Get me after logout - PASS, (18) MongoDB verification - PASS. MongoDB collections (customer_otps, customers, customer_sessions, customer_carts, orders) all being written correctly."
