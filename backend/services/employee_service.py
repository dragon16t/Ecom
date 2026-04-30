"""
Employee Management Service
Handles employee accounts with role-based access control
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from typing import Optional, List, Dict
import hashlib
import secrets


class EmployeeService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.employees
    
    def _hash_password(self, password: str) -> str:
        """Hash password with SHA-256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def _generate_password(self, length: int = 8) -> str:
        """Generate a random password"""
        return secrets.token_urlsafe(length)[:length]
    
    async def create_employee(
        self,
        username: str,
        name: str,
        permissions: Dict[str, bool],
        password: Optional[str] = None
    ) -> Dict:
        """Create a new employee account"""
        # Check if username exists
        existing = await self.collection.find_one({"username": username})
        if existing:
            return {"success": False, "error": "Username already exists"}
        
        # Generate password if not provided
        if not password:
            password = self._generate_password()
        
        employee = {
            "username": username,
            "name": name,
            "password_hash": self._hash_password(password),
            "permissions": {
                "orders": permissions.get("orders", False),
                "blogs": permissions.get("blogs", False),
                "ai_studio": permissions.get("ai_studio", False),
                "customers": permissions.get("customers", False),
                "analytics": permissions.get("analytics", False),
                "landing_pages": permissions.get("landing_pages", False),
                "consultations": permissions.get("consultations", False),
                "products": permissions.get("products", False),
                "retention": permissions.get("retention", False),
            },
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        }
        
        await self.collection.insert_one(employee)
        
        return {
            "success": True,
            "username": username,
            "password": password,  # Return plain password only on creation
            "permissions": employee["permissions"]
        }
    
    async def authenticate(self, username: str, password: str) -> Optional[Dict]:
        """Authenticate employee and return their data"""
        employee = await self.collection.find_one({
            "username": username,
            "password_hash": self._hash_password(password),
            "is_active": True
        })
        
        if employee:
            # Update last login
            await self.collection.update_one(
                {"_id": employee["_id"]},
                {"$set": {"last_login": datetime.now(timezone.utc)}}
            )
            
            return {
                "username": employee["username"],
                "name": employee["name"],
                "permissions": employee["permissions"]
            }
        return None
    
    async def get_all_employees(self) -> List[Dict]:
        """Get all employees"""
        employees = []
        cursor = self.collection.find({"is_active": True})
        async for emp in cursor:
            employees.append({
                "username": emp["username"],
                "name": emp["name"],
                "permissions": emp["permissions"],
                "created_at": emp.get("created_at"),
                "last_login": emp.get("last_login")
            })
        return employees
    
    async def update_password(self, username: str, new_password: str) -> bool:
        """Update employee password"""
        result = await self.collection.update_one(
            {"username": username},
            {"$set": {"password_hash": self._hash_password(new_password)}}
        )
        return result.modified_count > 0
    
    async def update_permissions(self, username: str, permissions: Dict[str, bool]) -> bool:
        """Update employee permissions"""
        result = await self.collection.update_one(
            {"username": username},
            {"$set": {"permissions": permissions}}
        )
        return result.modified_count > 0
    
    async def delete_employee(self, username: str) -> bool:
        """Soft delete employee (deactivate)"""
        result = await self.collection.update_one(
            {"username": username},
            {"$set": {"is_active": False}}
        )
        return result.modified_count > 0
    
    async def get_employee(self, username: str) -> Optional[Dict]:
        """Get single employee details"""
        emp = await self.collection.find_one({"username": username, "is_active": True})
        if emp:
            return {
                "username": emp["username"],
                "name": emp["name"],
                "permissions": emp["permissions"],
                "created_at": emp.get("created_at"),
                "last_login": emp.get("last_login")
            }
        return None
