#!/usr/bin/env python3
"""
Complete Admin Setup and Verification Script
"""

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import engine
from app.models.orm_models import AdminUser
from app.core.security import verify_password, get_password_hash
from app.schemas.auth import AdminCreate
from app.repositories.admin_user_repo import AdminUserRepository

async def main():
    print("🔧 Complete Admin Setup & Verification")
    print("=" * 60)
    
    # Create tables
    from app.db.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables verified\n")
    
    async_session = AsyncSession(engine)
    
    try:
        # Step 1: Check if admin exists
        print("📋 Step 1: Checking for existing admin user...")
        q = await async_session.execute(select(AdminUser).where(AdminUser.username == "admin"))
        admin = q.scalars().first()
        
        if admin:
            print(f"   ✅ Admin user found")
            print(f"      Username: {admin.username}")
            print(f"      Role: {admin.role}")
            print(f"      Hash (first 50 chars): {admin.password_hash[:50]}...")
        else:
            print(f"   ⚠️  Admin user not found, creating new one...")
            admin = None
        
        # Step 2: Create or recreate admin
        print("\n📋 Step 2: Creating/updating admin user...")
        
        repo = AdminUserRepository(async_session)
        
        # Delete existing if password is wrong
        if admin:
            try:
                test_result = verify_password("admin", admin.password_hash)
                if not test_result:
                    print(f"   ⚠️  Existing password hash is invalid, deleting...")
                    await async_session.delete(admin)
                    await async_session.commit()
                    admin = None
            except Exception as e:
                print(f"   ⚠️  Hash verification error: {e}")
                print(f"   ⚠️  Deleting invalid hash and recreating...")
                await async_session.delete(admin)
                await async_session.commit()
                admin = None
        
        if not admin:
            admin_data = AdminCreate(
                username="admin",
                password="admin",
                role="superadmin"
            )
            admin = await repo.create(admin_data)
            print(f"   ✅ New admin user created")
            print(f"      Username: {admin.username}")
            print(f"      Role: {admin.role}")
            print(f"      Hash (first 50 chars): {admin.password_hash[:50]}...")
        
        # Step 3: Verify password
        print("\n📋 Step 3: Verifying password...")
        try:
            is_valid = verify_password("admin", admin.password_hash)
            if is_valid:
                print(f"   ✅ Password verification PASSED")
            else:
                print(f"   ❌ Password verification FAILED")
                is_valid = False
        except Exception as e:
            print(f"   ❌ Password verification error: {e}")
            print(f"      Invalid hash format detected")
            is_valid = False
        
        if not is_valid:
            print(f"      Attempting to fix by recreating admin...")
            try:
                await async_session.delete(admin)
                await async_session.commit()
                
                admin_data = AdminCreate(
                    username="admin",
                    password="admin",
                    role="superadmin"
                )
                admin = await repo.create(admin_data)
                
                try:
                    is_valid = verify_password("admin", admin.password_hash)
                    if is_valid:
                        print(f"   ✅ Password verification now PASSES")
                    else:
                        print(f"   ❌ Password verification still FAILS")
                except Exception as verify_error:
                    print(f"   ❌ Password verification error: {verify_error}")
                    is_valid = False
            except Exception as fix_error:
                print(f"   ❌ Failed to fix admin: {fix_error}")
                is_valid = False
        
        # Step 4: Summary
        print("\n" + "=" * 60)
        print("📝 Login Credentials:")
        print(f"   Frontend: http://localhost:3000/admin/login")
        print(f"   Username: admin")
        print(f"   Password: admin")
        print("=" * 60)
        
        if is_valid:
            print("✅ Setup complete and verified!")
        else:
            print("❌ Setup has issues - see details above")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await async_session.close()
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())