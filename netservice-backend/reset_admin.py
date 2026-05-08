#!/usr/bin/env python3
"""
Direct Admin Reset - Clears old admin and creates new one
"""

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import engine
from app.core.security import get_password_hash

async def reset_admin():
    """Reset admin user directly"""
    async_session = AsyncSession(engine)
    
    try:
        print("[*] Direct Admin Reset")
        print("=" * 60)
        
        # Create tables first
        from app.db.base import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[OK] Database tables ready\n")
        
        # Delete any existing admin user
        print("[*] Clearing old admin user...")
        await async_session.execute(text("DELETE FROM admin_users WHERE username = 'admin'"))
        await async_session.commit()
        print("[OK] Old admin cleared\n")
        
        # Create new admin with bcrypt hash
        print("[*] Creating new admin user...")
        username = "admin"
        password = "admin"
        
        # Hash the password using bcrypt
        password_hash = get_password_hash(password)
        print(f"   Generated hash (first 50 chars): {password_hash[:50]}...")
        print(f"   Hash length: {len(password_hash)}")
        
        # Insert directly using SQL
        from app.schemas.auth import AdminRole
        role_value = "superadmin"
        
        insert_query = text("""
            INSERT INTO admin_users (username, password_hash, role)
            VALUES (:username, :password_hash, :role)
        """)
        
        await async_session.execute(insert_query, {
            "username": username,
            "password_hash": password_hash,
            "role": role_value
        })
        await async_session.commit()
        print("[OK] New admin user created\n")
        
        # Verify the admin exists
        from sqlalchemy.future import select
        from app.models.orm_models import AdminUser
        
        result = await async_session.execute(
            select(AdminUser).where(AdminUser.username == "admin")
        )
        admin = result.scalars().first()
        
        if admin:
            print("[*] Verifying admin...")
            print(f"   [OK] Admin found in database")
            print(f"      Username: {admin.username}")
            print(f"      Role: {admin.role}")
            print(f"      Hash (first 50 chars): {admin.password_hash[:50]}...\n")
            
            # Test password verification
            from app.core.security import verify_password
            try:
                is_valid = verify_password("admin", admin.password_hash)
                if is_valid:
                    print("[OK] Password verification PASSED\n")
                else:
                    print("[FAIL] Password verification FAILED\n")
            except Exception as e:
                print(f"[FAIL] Password verification error: {e}\n")
        else:
            print("[FAIL] Admin not found after creation!\n")
        
        # Print credentials
        print("=" * 60)
        print("Login Credentials:")
        print("   Frontend: http://localhost:3000/admin/login")
        print("   Username: admin")
        print("   Password: admin")
        print("=" * 60)
        print("[OK] Admin reset complete!")
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await async_session.close()
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(reset_admin())