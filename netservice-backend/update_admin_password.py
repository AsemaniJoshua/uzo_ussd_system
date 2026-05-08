#!/usr/bin/env python3
"""
Update Admin Password
"""

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import engine
from app.core.security import get_password_hash
from app.models.orm_models import AdminUser
import getpass


async def update_admin_password():
    """Update admin password"""
    async_session = AsyncSession(engine)
    
    try:
        print("=" * 60)
        print("Update Admin Password")
        print("=" * 60)
        
        # Get username
        username = input("Enter admin username [admin]: ").strip() or "admin"
        
        # Get new password (hidden input)
        print("\nEnter new password (input will be hidden):")
        new_password = getpass.getpass("New Password: ")
        confirm_password = getpass.getpass("Confirm Password: ")
        
        if new_password != confirm_password:
            print("\n[ERROR] Passwords do not match!")
            return
        
        if len(new_password) < 6:
            print("\n[ERROR] Password must be at least 6 characters!")
            return
        
        # Find admin user
        print(f"\n[*] Looking for user '{username}'...")
        result = await async_session.execute(
            select(AdminUser).where(AdminUser.username == username)
        )
        admin = result.scalars().first()
        
        if not admin:
            print(f"[ERROR] User '{username}' not found!")
            return
        
        # Update password
        print("[*] Updating password...")
        new_hash = get_password_hash(new_password)
        admin.password_hash = new_hash
        
        await async_session.commit()
        await async_session.refresh(admin)
        
        print("[OK] Password updated successfully!")
        print("\n" + "=" * 60)
        print("New Login Credentials:")
        print(f"   Username: {username}")
        print(f"   Password: {new_password}")
        print("=" * 60)
        
        # Verify the update
        from app.core.security import verify_password
        is_valid = verify_password(new_password, admin.password_hash)
        if is_valid:
            print("\n[OK] Password verification successful!")
        else:
            print("\n[WARNING] Password verification failed - please try again")
        
    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await async_session.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(update_admin_password())
